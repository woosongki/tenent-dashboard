#!/usr/bin/env node
/**
 * 기존 도면(PNG/JPEG) 일괄 WebP 변환 + 캐시 헤더 갱신
 *
 * 출력: src/data 변경 없음 — Supabase Storage + DB 직접 갱신
 * 실행: node scripts/optimize-floorplans.mjs
 *       (옵션) --dry-run  : 실제 변환·업로드 안 하고 시뮬레이션만
 *
 * 사전조건:
 *   - .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - npm install sharp (이미 package.json에 있음)
 *
 * 동작:
 *   1. floorplans 테이블의 모든 행 조회
 *   2. mime_type이 image/png 또는 image/jpeg인 항목만 처리
 *   3. Storage에서 원본 다운로드 → sharp로 WebP 변환 (resize 2400 cap, quality 80)
 *   4. 새 파일을 .webp 확장자로 업로드 (cacheControl 1년 immutable)
 *   5. DB의 storage_path / public_url / mime_type / size_bytes 갱신
 *   6. 원본 파일 삭제
 *
 * 안전성: 한 행씩 트랜잭션처럼 처리 → 실패해도 다른 행 영향 없음.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

(function loadEnvLocal() {
  try {
    const txt = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
})();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("❌ .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "floorplans";
const WEBP_MAX_DIM = 2400;
const WEBP_QUALITY = 80;
const CACHE_CONTROL = "31536000, immutable";

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

function slugify(s) {
  return s.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9가-힣_\-]/g, "");
}

function fmtBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

async function processOne(row) {
  // PNG/JPEG가 아니면 스킵 (단, cacheControl만 갱신할 필요 있을 수도 있는데
  // Supabase API는 기존 객체 메타 갱신을 지원하지 않으므로 그냥 패스)
  if (row.mime_type !== "image/png" && row.mime_type !== "image/jpeg") {
    return { skipped: true, reason: row.mime_type };
  }

  // 1) 원본 다운로드
  const { data: blob, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(row.storage_path);
  if (dlErr || !blob) {
    return { failed: true, reason: `download: ${dlErr?.message ?? "no data"}` };
  }
  const originalBuf = Buffer.from(await blob.arrayBuffer());
  const originalSize = originalBuf.length;

  // 2) WebP 변환
  const webpBuf = await sharp(originalBuf)
    .resize({ width: WEBP_MAX_DIM, height: WEBP_MAX_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const newSize = webpBuf.length;
  const ratio = ((1 - newSize / originalSize) * 100).toFixed(1);

  // WebP가 더 크면 굳이 갱신 안 함 (드물지만 small SVG-like PNG)
  if (newSize >= originalSize) {
    return { skipped: true, reason: `WebP가 더 큼 (${fmtBytes(newSize)} vs ${fmtBytes(originalSize)})` };
  }

  if (DRY_RUN) {
    return {
      ok: true, dryRun: true,
      originalSize, newSize, ratio,
      oldPath: row.storage_path,
    };
  }

  // 3) 새 경로 (원본은 dir 유지, ext만 webp로, timestamp 갱신)
  const dir = path.posix.dirname(row.storage_path);
  const newPath = `${dir}/${slugify(row.floor_label)}-${Date.now()}.webp`;

  // 4) 새 파일 업로드
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, webpBuf, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: CACHE_CONTROL,
    });
  if (upErr) return { failed: true, reason: `upload: ${upErr.message}` };

  // 5) public URL
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(newPath);

  // 6) DB 업데이트
  const { error: dbErr } = await supabase
    .from("floorplans")
    .update({
      storage_path: newPath,
      public_url:   pub.publicUrl,
      mime_type:    "image/webp",
      size_bytes:   newSize,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", row.id);
  if (dbErr) {
    // DB 실패 시 새 파일 정리
    await supabase.storage.from(BUCKET).remove([newPath]);
    return { failed: true, reason: `db: ${dbErr.message}` };
  }

  // 7) 원본 파일 삭제
  await supabase.storage.from(BUCKET).remove([row.storage_path]);

  return { ok: true, originalSize, newSize, ratio, oldPath: row.storage_path, newPath };
}

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN — 변경 없음\n" : "🚀 실제 변환 시작\n");

  // 모든 도면 행 조회
  const { data: rows, error } = await supabase
    .from("floorplans")
    .select("id, store_id, floor_label, storage_path, mime_type, size_bytes")
    .order("updated_at", { ascending: true });
  if (error) { console.error("❌ DB 조회 실패:", error.message); process.exit(1); }
  if (!rows?.length) { console.log("(처리할 도면 없음)"); return; }

  console.log(`총 ${rows.length}개 도면 검사 중...\n`);

  let processed = 0, savedBefore = 0, savedAfter = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const result = await processOne(row);
    const tag = `[${row.store_id}/${row.floor_label}]`.padEnd(40);

    if (result.skipped) {
      skipped++;
      console.log(`${tag} ⏭  ${result.reason}`);
    } else if (result.failed) {
      failed++;
      console.log(`${tag} ❌ ${result.reason}`);
    } else if (result.ok) {
      processed++;
      savedBefore += result.originalSize;
      savedAfter  += result.newSize;
      console.log(`${tag} ✅ ${fmtBytes(result.originalSize)} → ${fmtBytes(result.newSize)}  (-${result.ratio}%)`);
    }
  }

  console.log("\n────────────────────────────────");
  console.log(`  변환:  ${processed}건`);
  console.log(`  스킵:  ${skipped}건`);
  console.log(`  실패:  ${failed}건`);
  if (savedBefore > 0) {
    const totalSaved = savedBefore - savedAfter;
    const totalRatio = ((1 - savedAfter / savedBefore) * 100).toFixed(1);
    console.log(`  용량:  ${fmtBytes(savedBefore)} → ${fmtBytes(savedAfter)}`);
    console.log(`  절감:  ${fmtBytes(totalSaved)}  (-${totalRatio}%)`);
  }
  console.log("────────────────────────────────");
  if (DRY_RUN) console.log("\n💡 실제 적용하려면 --dry-run 빼고 다시 실행");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
