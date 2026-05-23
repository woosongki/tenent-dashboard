"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { computeSortOrder, type Floorplan } from "./queries";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
// Supabase Storage 캐시 헤더 — 도면은 파일명에 timestamp가 포함되어 사실상 immutable.
// 브라우저/CDN에서 1년간 재요청 없이 캐시 → 무료 한도(5GB/월) 절약 핵심.
const CACHE_CONTROL = "31536000, immutable";
// WebP 변환 시 최대 변환 크기 (도면 가독성 유지하면서 용량 감소)
const WEBP_MAX_DIM = 2400;
const WEBP_QUALITY = 80;
// 썸네일 (미리보기 타일 전용) — 미리보기 egress 90%↓
const THUMB_MAX_DIM = 400;
const THUMB_QUALITY = 55;

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/** 안전한 파일명 슬러그화 */
function slugify(s: string): string {
  return s.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9가-힣_\-]/g, "");
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png":     return "png";
    case "image/jpeg":    return "jpg";
    case "image/webp":    return "webp";
    case "image/svg+xml": return "svg";
    case "application/pdf": return "pdf";
    default:              return "bin";
  }
}

export async function uploadFloorplan(formData: FormData): Promise<Result<Floorplan>> {
  const storeId    = String(formData.get("storeId")    ?? "").trim();
  const floorLabel = String(formData.get("floorLabel") ?? "").trim();
  const file       = formData.get("file") as File | null;

  if (!storeId)    return { ok: false, error: "storeId 누락" };
  if (!floorLabel) return { ok: false, error: "층 라벨 누락" };
  if (!file)       return { ok: false, error: "파일 누락" };

  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: `지원되지 않는 형식: ${file.type}` };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `파일 크기 초과 (${Math.round(file.size / 1024 / 1024)}MB > 20MB)` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "인증 필요" };

  // 1) 같은 (store_id, floor_label) 기존 행이 있으면 storage 파일도 함께 삭제
  const { data: existing } = await supabase
    .from("floorplans")
    .select("id, storage_path")
    .eq("store_id", storeId)
    .eq("floor_label", floorLabel)
    .maybeSingle();
  if (existing?.storage_path) {
    await supabase.storage.from("floorplans").remove([
      existing.storage_path,
      `${existing.storage_path}.thumb.webp`,
    ]);
  }

  // 2) PNG/JPEG는 WebP로 자동 변환 + 리사이즈 (Egress 70~90% 절감)
  //    SVG/PDF/WebP는 원본 그대로 업로드.
  const originalBuf = Buffer.from(await file.arrayBuffer());
  let uploadBuf: Buffer = originalBuf;
  let uploadMime = file.type;
  let uploadExt = extFromMime(file.type);
  let uploadSize = file.size;

  if (file.type === "image/png" || file.type === "image/jpeg") {
    try {
      uploadBuf = await sharp(originalBuf)
        .resize({ width: WEBP_MAX_DIM, height: WEBP_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      uploadMime = "image/webp";
      uploadExt = "webp";
      uploadSize = uploadBuf.length;
    } catch (err) {
      console.warn("[floorplans.upload] WebP 변환 실패, 원본 업로드:", err);
    }
  }

  // 파일명: {storeId}/{floorLabelSlug}-{timestamp}.{ext}
  const path = `${storeId}/${slugify(floorLabel)}-${Date.now()}.${uploadExt}`;

  // 3) Storage 업로드 (캐시 1년 immutable)
  const { error: upErr } = await supabase.storage
    .from("floorplans")
    .upload(path, uploadBuf, {
      contentType: uploadMime,
      upsert: true,
      cacheControl: CACHE_CONTROL,
    });
  if (upErr) {
    console.error("[floorplans.upload] Storage error:", upErr);
    return { ok: false, error: `Storage 업로드 실패: ${upErr.message}` };
  }

  // 3b) 썸네일 생성 (PDF/SVG 제외, 이미지만)
  //     파일명 규칙: {원본path}.thumb.webp — 클라이언트가 예측 가능
  //     미리보기는 썸네일만 → 풀이미지 다운로드 회피로 egress -90%
  if (uploadMime.startsWith("image/") && uploadMime !== "image/svg+xml") {
    try {
      const thumbBuf = await sharp(originalBuf)
        .resize({ width: THUMB_MAX_DIM, height: THUMB_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer();
      const thumbPath = `${path}.thumb.webp`;
      await supabase.storage.from("floorplans").upload(thumbPath, thumbBuf, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: CACHE_CONTROL,
      });
    } catch (err) {
      console.warn("[floorplans.upload] 썸네일 생성 실패 (계속 진행):", err);
    }
  }

  // 4) 공개 URL
  const { data: pub } = supabase.storage.from("floorplans").getPublicUrl(path);

  // 5) DB upsert (변환 후 mime/size 저장)
  const record = {
    store_id:     storeId,
    floor_label:  floorLabel,
    storage_path: path,
    public_url:   pub.publicUrl,
    mime_type:    uploadMime,
    size_bytes:   uploadSize,
    sort_order:   computeSortOrder(floorLabel),
    uploaded_by:  user.id,
    updated_at:   new Date().toISOString(),
  };

  const { data: row, error: dbErr } = await supabase
    .from("floorplans")
    .upsert(record, { onConflict: "store_id,floor_label" })
    .select()
    .single();

  if (dbErr) {
    // DB 실패 시 업로드한 파일 정리
    await supabase.storage.from("floorplans").remove([path]);
    return { ok: false, error: `DB 저장 실패: ${dbErr.message}` };
  }

  revalidatePath("/dashboard/floorplans");
  return { ok: true, data: row as Floorplan };
}

export async function deleteFloorplan(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "인증 필요" };

  const { data: row, error: getErr } = await supabase
    .from("floorplans")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (getErr || !row) return { ok: false, error: "도면을 찾을 수 없음" };

  // Storage 파일 + 썸네일 삭제 (실패해도 DB는 진행)
  await supabase.storage.from("floorplans").remove([row.storage_path, `${row.storage_path}.thumb.webp`]);

  const { error: dbErr } = await supabase.from("floorplans").delete().eq("id", id);
  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath("/dashboard/floorplans");
  return { ok: true };
}
