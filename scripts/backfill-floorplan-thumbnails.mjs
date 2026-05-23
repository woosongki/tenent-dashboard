#!/usr/bin/env node
/**
 * 기존 floorplans 모든 이미지 파일에 대해 썸네일을 1회성 생성합니다.
 * 실행 후: 미리보기 타일이 원본(~100KB) 대신 썸네일(~10KB) 로드 → Storage egress -90%
 *
 * 사용:
 *   node scripts/backfill-floorplan-thumbnails.mjs
 *
 * 동작:
 *   1. floorplans 테이블에서 이미지 파일 (storage_path) 모두 조회
 *   2. 각 파일에 대해 {path}.thumb.webp가 이미 있으면 스킵
 *   3. 없으면 원본 다운로드 → sharp 400px webp q55 변환 → 업로드
 *
 * 비용:
 *   - 원본 다운로드는 Storage egress 1회 발생 (~50-150KB × 파일 수)
 *   - 1회만 실행, 이후 영구 절감
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

config({ path: ".env.local", override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const THUMB_MAX_DIM = 400;
const THUMB_QUALITY = 55;
const CACHE_CONTROL = "31536000, immutable";

async function main() {
  console.log("📋 floorplans 목록 조회 중...");
  const { data: rows, error } = await supabase
    .from("floorplans")
    .select("id, storage_path, mime_type, size_bytes, floor_label");
  if (error || !rows) {
    console.error("❌ 조회 실패:", error?.message);
    process.exit(1);
  }
  console.log(`   ${rows.length}개 행`);

  // 이미지만 (PDF·SVG 제외)
  const imageRows = rows.filter(
    (r) =>
      r.mime_type?.startsWith("image/") && r.mime_type !== "image/svg+xml"
  );
  console.log(`   이미지: ${imageRows.length}개 (PDF/SVG 제외)`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let totalSavedBytes = 0;

  for (let i = 0; i < imageRows.length; i++) {
    const row = imageRows[i];
    const prefix = `[${i + 1}/${imageRows.length}]`;
    const thumbPath = `${row.storage_path}.thumb.webp`;

    // 1. 썸네일 이미 있는지 체크 (HEAD 요청)
    try {
      const { data: existing } = await supabase.storage
        .from("floorplans")
        .list(row.storage_path.split("/").slice(0, -1).join("/"), {
          search: row.storage_path.split("/").pop() + ".thumb.webp",
          limit: 1,
        });
      if (existing && existing.length > 0) {
        console.log(`${prefix} ⏭  ${row.floor_label} — 썸네일 이미 있음`);
        skipped++;
        continue;
      }
    } catch {
      // 무시하고 계속
    }

    // 2. 원본 다운로드
    let originalBuf;
    try {
      const { data, error: dlErr } = await supabase.storage
        .from("floorplans")
        .download(row.storage_path);
      if (dlErr || !data) throw new Error(dlErr?.message ?? "다운로드 실패");
      originalBuf = Buffer.from(await data.arrayBuffer());
    } catch (e) {
      console.log(`${prefix} ❌ ${row.floor_label} — 원본 다운로드 실패: ${e.message}`);
      failed++;
      continue;
    }

    // 3. 썸네일 생성
    let thumbBuf;
    try {
      thumbBuf = await sharp(originalBuf)
        .resize({ width: THUMB_MAX_DIM, height: THUMB_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toBuffer();
    } catch (e) {
      console.log(`${prefix} ❌ ${row.floor_label} — sharp 변환 실패: ${e.message}`);
      failed++;
      continue;
    }

    // 4. 썸네일 업로드
    try {
      const { error: upErr } = await supabase.storage
        .from("floorplans")
        .upload(thumbPath, thumbBuf, {
          contentType: "image/webp",
          upsert: true,
          cacheControl: CACHE_CONTROL,
        });
      if (upErr) throw new Error(upErr.message);
    } catch (e) {
      console.log(`${prefix} ❌ ${row.floor_label} — 업로드 실패: ${e.message}`);
      failed++;
      continue;
    }

    const savedPct = Math.round(((originalBuf.length - thumbBuf.length) / originalBuf.length) * 100);
    totalSavedBytes += originalBuf.length - thumbBuf.length;
    console.log(
      `${prefix} ✅ ${row.floor_label} — ${Math.round(originalBuf.length / 1024)}KB → ${Math.round(thumbBuf.length / 1024)}KB (-${savedPct}%)`
    );
    created++;
  }

  console.log("\n📊 완료");
  console.log(`   생성: ${created}개`);
  console.log(`   스킵: ${skipped}개 (이미 존재)`);
  console.log(`   실패: ${failed}개`);
  console.log(`   파일당 평균 절약: ${created > 0 ? Math.round(totalSavedBytes / created / 1024) : 0}KB`);
  console.log(`\n🎯 다음 미리보기 페이지 로드부터 썸네일이 사용됩니다 (egress -90%).`);
}

main().catch((e) => {
  console.error("❌ 오류:", e.message ?? e);
  process.exit(1);
});
