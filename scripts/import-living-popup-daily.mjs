#!/usr/bin/env node
/**
 * 리빙 주제전 — 팝업 일매출 일괄 import.
 *
 * 입력: data/raw/living-popup-daily-2026.tsv (long format, 헤더 첫 줄)
 *   store	brand	date	sales
 *   중계점	락앤락	2026-01-21	2500000
 *   ...
 *
 * 매칭 규칙:
 *   - LIVING_BRANDS 16개만 처리 (기타 무시)
 *   - 쿤리쿤→쿤리콘, 수엔지→수앤지 자동 정정
 *   - 지점 단축형(예: "중계","수터") → canonical("중계점","수원터미널점") 정규화
 *   - living_popup 중 (brand, normalizeStore(store)) 일치하고
 *     date ∈ [start_date, end_date] 인 행을 매치
 *   - 다중 매치 / 미매치는 콘솔에 경고만 남기고 진행
 *
 * 실행:
 *   node scripts/import-living-popup-daily.mjs
 *   node scripts/import-living-popup-daily.mjs --in path/to/file.tsv
 *   node scripts/import-living-popup-daily.mjs --dry          # DB 변경 없음, 매칭만 검사
 *
 * 사전조건: .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * 동작:
 *   - 매칭된 (popup_id, date) 단위로 living_popup_daily upsert (onConflict: popup_id,date)
 *   - 영향받은 popup별 sales 합계 재계산 → living_popup.sales(백만) 갱신
 *   - 조직 식별: living_popup 행에 organization_id가 채워져 있어야 함(기존 시드/입력 기준)
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

(function loadEnv() {
  const t = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
  for (const l of t.split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function argv(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const IN_PATH = argv("--in", path.join(ROOT, "data", "raw", "living-popup-daily-2026.tsv"));
const DRY = process.argv.includes("--dry");
const YEAR = Number(argv("--year", "2026"));

// src/lib/livingPopup.ts 와 동일. 포트메리온은 ERP 우산 표기로 importer 내부에서만 사용.
const LIVING_BRANDS = new Set([
  "락앤락", "글라스락", "알리페즈", "광인상사", "테팔", "수앤지",
  "하우담", "아르페지오", "커스티", "이브자리", "쿡셀", "몽드블랑",
  "지포트리", "파고", "쿤리콘", "정인",
  "포트메리온",
]);

// 사용자 입력의 옛 표기/오기 → canonical
const BRAND_ALIAS = {
  "쿤리쿤": "쿤리콘",
  "수엔지": "수앤지",
};

// 우산 브랜드 — ERP 코드 1개를 여러 popup 브랜드로 분기 매칭.
// 포트메리온(ERP) 일매출 → 광인상사/하우담/몽드블랑/포트메리온 popup 중 (지점, 날짜) 매치되는 행에 적용.
const UMBRELLA_BRANDS = {
  "포트메리온": ["포트메리온", "광인상사", "하우담", "몽드블랑"],
};
function brandCandidatesFor(brand) {
  return UMBRELLA_BRANDS[brand] ?? [brand];
}

// src/types/attraction.ts ATTRACTION_BRANCHES
const STORES = new Set([
  "강남점", "중계점", "불광점", "야탑점", "산본점", "분당점", "덕천점", "고잔점", "강서점",
  "천호2점", "송파점", "평촌2점", "평택점", "안양점", "창원점", "수성점", "해운대점", "부천점",
  "부평점", "동수원", "일산점", "인천점", "울산2점", "강북점", "광명점", "대전 유성점", "울산점",
  "경산점", "충장점", "부산대점", "중앙로역점", "순천점", "청주점", "신구로점",
  "광주역점", "수원터미널점", "엑스코점", "전주점", "괴정점", "구미점", "쇼핑점",
]);
const STORE_ALIAS = {
  "수터": "수원터미널점", "터미널": "수원터미널점",
  "유성": "대전 유성점", "NC대전 유성점": "대전 유성점", "NC대전유성점": "대전 유성점",
  "평촌": "평촌2점", "천호": "천호2점", "울산": "울산점",
};

function normalizeStore(s) {
  if (!s) return "";
  const t = String(s).trim();
  if (STORE_ALIAS[t]) return STORE_ALIAS[t];
  if (STORES.has(t)) return t;
  const withSuffix = `${t}점`;
  if (STORES.has(withSuffix)) return withSuffix;
  return t;
}

function normalizeBrand(b) {
  if (!b) return "";
  const t = String(b).trim();
  return BRAND_ALIAS[t] ?? t;
}

function parseTsv(file) {
  if (!existsSync(file)) throw new Error(`입력 파일 없음: ${file}`);
  const txt = readFileSync(file, "utf8").replace(/^﻿/, "");
  const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("입력 파일이 비어있거나 헤더만 존재합니다.");
  const head = lines[0].split("\t").map((s) => s.trim().toLowerCase());
  const need = ["store", "brand", "date", "sales"];
  for (const n of need) if (!head.includes(n)) throw new Error(`헤더에 '${n}' 컬럼이 없습니다. (필요: ${need.join(", ")})`);
  const ci = Object.fromEntries(head.map((h, i) => [h, i]));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split("\t");
    const store = v[ci.store]?.trim();
    const brand = v[ci.brand]?.trim();
    const date = v[ci.date]?.trim();
    const sales = Number(String(v[ci.sales] ?? "").replace(/[,\s]/g, ""));
    if (!store || !brand || !date) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.warn(`  ⚠ 날짜 형식 오류(L${i + 1}): ${date}`); continue; }
    if (!Number.isFinite(sales)) continue;
    rows.push({ store, brand, date, sales });
  }
  return rows;
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

async function loadPopups(year) {
  // 모든 조직의 living_popup을 한번에 끌어오되 organization_id별로 분리해 매칭.
  // 일반적으로 단일 조직 운영이지만 다중 조직 환경에서도 안전하게 동작.
  const { data, error } = await sb
    .from("living_popup")
    .select("id,organization_id,brand,store,start_date,end_date,year")
    .eq("year", year);
  if (error) throw new Error(`living_popup 조회 실패: ${error.message}`);
  return data ?? [];
}

function buildIndex(popups) {
  // key: `${normalizedBrand}|${normalizedStore}` → popup[]
  const idx = new Map();
  for (const p of popups) {
    const key = `${normalizeBrand(p.brand)}|${normalizeStore(p.store)}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(p);
  }
  return idx;
}

async function main() {
  console.log(`📂 입력: ${IN_PATH}`);
  console.log(`📅 연도: ${YEAR}${DRY ? "  · dry-run" : ""}`);

  const rawRows = parseTsv(IN_PATH);
  console.log(`📄 입력 행: ${rawRows.length}`);

  const popups = await loadPopups(YEAR);
  console.log(`🗄  living_popup(${YEAR}): ${popups.length}건`);
  const idx = buildIndex(popups);

  let skipNonLiving = 0;
  let matched = 0;
  let unmatched = 0;
  let ambiguous = 0;
  const upserts = new Map(); // key: `${orgId}|${popupId}|${date}` → { organization_id, popup_id, date, sales }
  const affected = new Set();
  const unmatchedSamples = [];
  const ambiguousSamples = [];

  for (const r of rawRows) {
    const brand = normalizeBrand(r.brand);
    if (!LIVING_BRANDS.has(brand)) { skipNonLiving++; continue; }
    if (r.sales <= 0) continue;

    const store = normalizeStore(r.store);
    const brandsToTry = brandCandidatesFor(brand);
    const cands = brandsToTry
      .flatMap((b) => idx.get(`${b}|${store}`) ?? [])
      .filter((p) => inRange(r.date, p.start_date, p.end_date));

    if (cands.length === 0) {
      unmatched++;
      if (unmatchedSamples.length < 20) unmatchedSamples.push({ store, brand, date: r.date, sales: r.sales });
      continue;
    }
    if (cands.length > 1) {
      ambiguous++;
      if (ambiguousSamples.length < 10) ambiguousSamples.push({ store, brand, date: r.date, popupIds: cands.map((c) => c.id) });
    }

    // 다중 매치 시 첫 번째 사용 — 운영상 같은 지점·브랜드 기간 겹침은 흔치 않음.
    const popup = cands[0];
    const k = `${popup.organization_id}|${popup.id}|${r.date}`;
    const prev = upserts.get(k);
    const next = (prev?.sales ?? 0) + r.sales;
    upserts.set(k, { organization_id: popup.organization_id, popup_id: popup.id, date: r.date, sales: next });
    affected.add(popup.id);
    matched++;
  }

  console.log("");
  console.log(`✅ 매치     : ${matched}`);
  console.log(`⚠  미매치   : ${unmatched}`);
  console.log(`⚠  다중매치 : ${ambiguous}`);
  console.log(`⏭  비-리빙브랜드 무시: ${skipNonLiving}`);
  console.log(`📦 upsert 대상(중복 합산 후): ${upserts.size}건 / 영향 팝업: ${affected.size}건`);

  if (unmatchedSamples.length) {
    console.log("\n  미매치 샘플:");
    for (const u of unmatchedSamples) console.log(`   - ${u.brand} / ${u.store} / ${u.date} / ${u.sales.toLocaleString()}원`);
  }
  if (ambiguousSamples.length) {
    console.log("\n  다중매치 샘플:");
    for (const a of ambiguousSamples) console.log(`   - ${a.brand} / ${a.store} / ${a.date} → ${a.popupIds.join(", ")}`);
  }

  if (DRY) {
    console.log("\n🛑 dry-run — DB 변경 없음.");
    return;
  }
  if (upserts.size === 0) {
    console.log("\n✋ upsert 대상이 없습니다.");
    return;
  }

  // 1) living_popup_daily upsert (organization_id별 청크)
  const rows = [...upserts.values()].map((r) => ({ ...r, sales: Math.round(r.sales) }));
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await sb
      .from("living_popup_daily")
      .upsert(chunk, { onConflict: "popup_id,date" });
    if (error) throw new Error(`daily upsert 실패 @${i}: ${error.message}`);
    process.stdout.write(`\r  daily upsert ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log("\n  ✅ daily upsert 완료");

  // 2) 영향 팝업별 sales(백만) 재계산
  let recalc = 0;
  for (const popupId of affected) {
    const { data: drows, error } = await sb
      .from("living_popup_daily")
      .select("sales")
      .eq("popup_id", popupId);
    if (error) { console.error(`  합계 조회 실패(${popupId}):`, error.message); continue; }
    const totalWon = (drows ?? []).reduce((t, r) => t + Number(r.sales), 0);
    const totalMil = totalWon ? Math.round(totalWon / 1e6) : null;
    const { error: ue } = await sb.from("living_popup")
      .update({ sales: totalMil })
      .eq("id", popupId);
    if (ue) { console.error(`  sales 갱신 실패(${popupId}):`, ue.message); continue; }
    recalc++;
    process.stdout.write(`\r  popup.sales 재계산 ${recalc}/${affected.size}`);
  }
  console.log(`\n  ✅ popup.sales ${recalc}건 재계산 완료`);
  console.log("\n🎉 import 완료");
}

main().catch((e) => { console.error("\n❌", e.message); process.exit(1); });
