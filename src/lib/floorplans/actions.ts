"use server";

import { revalidatePath } from "next/cache";
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

  // 파일명: {storeId}/{floorLabelSlug}-{timestamp}.{ext}
  // (timestamp 추가로 같은 층 재업로드 시 캐시 우회)
  const ext = extFromMime(file.type);
  const path = `${storeId}/${slugify(floorLabel)}-${Date.now()}.${ext}`;

  // 1) 같은 (store_id, floor_label) 기존 행이 있으면 storage 파일도 함께 삭제
  const { data: existing } = await supabase
    .from("floorplans")
    .select("id, storage_path")
    .eq("store_id", storeId)
    .eq("floor_label", floorLabel)
    .maybeSingle();
  if (existing?.storage_path) {
    await supabase.storage.from("floorplans").remove([existing.storage_path]);
  }

  // 2) Storage 업로드
  const buf = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from("floorplans")
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) {
    console.error("[floorplans.upload] Storage error:", upErr);
    return { ok: false, error: `Storage 업로드 실패: ${upErr.message}` };
  }

  // 3) 공개 URL
  const { data: pub } = supabase.storage.from("floorplans").getPublicUrl(path);

  // 4) DB upsert
  const record = {
    store_id:     storeId,
    floor_label:  floorLabel,
    storage_path: path,
    public_url:   pub.publicUrl,
    mime_type:    file.type,
    size_bytes:   file.size,
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

  // Storage 파일 삭제 (실패해도 DB는 진행)
  await supabase.storage.from("floorplans").remove([row.storage_path]);

  const { error: dbErr } = await supabase.from("floorplans").delete().eq("id", id);
  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath("/dashboard/floorplans");
  return { ok: true };
}
