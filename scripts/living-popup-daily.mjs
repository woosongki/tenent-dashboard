#!/usr/bin/env node
/**
 * 리빙 주제전 — 팝업 일매출 파이프라인 (변환 + import + 미매치 리포트 통합).
 *
 * 기존 3개 스크립트(convert-living-popup-daily-wide / import-living-popup-daily /
 * report-living-popup-unmatched)를 병합 — 매칭 규칙(브랜드·지점 별칭, 우산 브랜드)이
 * 세 곳에 중복 정의돼 드리프트하던 것을 한 곳으로.
 *
 * 사용:
 *   node scripts/living-popup-daily.mjs --convert        # wide.tsv → long tsv 변환만
 *   node scripts/living-popup-daily.mjs --dry            # 매칭 검사만 (DB 변경 없음)
 *   node scripts/living-popup-daily.mjs --report         # 미매치 (브랜드,지점) 요약
 *   node scripts/living-popup-daily.mjs                  # import (daily upsert + popup.sales 재계산)
 *   옵션: --in <long.tsv>  --wide-in <wide.tsv>  --year 2026
 *
 * 입력:
 *   wide: data/raw/living-popup-daily-<year>.wide.tsv (ERP 붙여넣기, 행=지점×브랜드, 열=일자)
 *   long: data/raw/living-popup-daily-<year>.tsv      (store\tbrand\tdate\tsales)
 *
 * 사전조건(import/report): .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argv(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const YEAR = Number(argv("--year", "2026"));
const LONG_PATH = argv("--in", path.join(ROOT, "data", "raw", `living-popup-daily-${YEAR}.tsv`));
const WIDE_PATH = argv("--wide-in", path.join(ROOT, "data", "raw", `living-popup-daily-${YEAR}.wide.tsv`));
const MODE = process.argv.includes("--convert") ? "convert"
  : process.argv.includes("--report") ? "report"
  : process.argv.includes("--dry") ? "dry"
  : "import";

// ── 공용 매칭 규칙 (단일 정의 — 여기만 고치면 전 모드 반영) ─────────────
// src/lib/livingPopup.ts 와 동일. 포트메리온은 ERP 우산 표기.
const LIVING_BRANDS = new Set([
  "락앤락", "글라스락", "알리페즈", "광인상사", "테팔", "수앤지",
  "하우담", "아르페지오", "커스티", "이브자리", "쿡셀", "몽드블랑",
  "지포트리", "파고", "쿤리콘", "정인",
  "포트메리온",
]);
const BRAND_ALIAS = { "쿤리쿤": "쿤리콘", "수엔지": "수앤지" };
// 우산 브랜드 — ERP 코드 1개를 여러 popup 브랜드로 분기 매칭.
const UMBRELLA_BRANDS = { "포트메리온": ["포트메리온", "광인상사", "하우담", "몽드블랑"] };
const brandCandidatesFor = (b) => UMBRELLA_BRANDS[b] ?? [b];

// ERP 브랜드 코드 → canonical LIVING 브랜드명 (wide 변환용).
const BRAND_BY_CODE = {
  H499: "락앤락", I102: "글라스락", H625: "알리페즈", I301: "테팔",
  H545: "수앤지", H636: "아르페지오", H773: "커스티", H991: "이브자리",
  I664: "쿡셀", H594: "지포트리", I506: "파고", H626: "쿤리콘",
  H578: "정인", I050: "포트메리온",
};

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
const normalizeBrand = (b) => BRAND_ALIAS[(b ?? "").trim()] ?? (b ?? "").trim();
const inRange = (d, s, e) => d >= s && d <= e;

// ── env + supabase (convert 모드는 불필요) ─────────────────────────────
function makeSupabase() {
  const t = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
  for (const l of t.split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

// ── convert: wide → long ──────────────────────────────────────────────
const MIN_SALES = 100_000; // 10만원 이하는 무시 (오기/리턴 노이즈 거름)

function runConvert() {
  const raw = readFileSync(WIDE_PATH, "utf8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/);
  const pickSplitter = (line) => (line.includes("\t") ? /\t/ : / {2,}/);

  // 날짜 헤더 행: YYYY-MM-DD 모양 컬럼이 50개 이상인 행 (연도 무관 — 구버전은 특정 날짜 하드코딩)
  let dateRow = null, splitter = null;
  for (const ln of lines) {
    const sp = pickSplitter(ln);
    const fields = ln.split(sp);
    const nDates = fields.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.trim())).length;
    if (nDates >= 50) { splitter = sp; dateRow = fields; break; }
  }
  if (!dateRow) {
    console.error("❌ 날짜 헤더 행을 찾지 못했습니다. (YYYY-MM-DD 컬럼 50개 이상인 행 필요)");
    process.exit(1);
  }
  const dateAt = [];
  for (let i = 0; i < dateRow.length; i++) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateRow[i].trim())) dateAt.push([i, dateRow[i].trim()]);
  }
  console.log(`📅 일자 컬럼 ${dateAt.length}개 (${dateAt[0][1]} ~ ${dateAt[dateAt.length - 1][1]})`);

  const out = ["store\tbrand\tdate\tsales"];
  let matchedLeafRows = 0, skippedNonLiving = 0, skippedAggregate = 0, cells = 0;
  const perBrand = new Map(), perStore = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const ln of lines) {
    if (!ln.trim()) continue;
    const fields = ln.split(splitter);
    if (fields.length < 50) continue;   // 헤더/요약행 회피 휴리스틱
    // 데이터 행 모양: [code, store, group, category, brand_code, brand_name, total, ...dates]
    const storeName = (fields[1] ?? "").trim();
    const brandCode = (fields[4] ?? "").trim();
    if (!storeName || !brandCode) continue;
    if (brandCode === "결과" || brandCode === "#") { skippedAggregate++; continue; }
    if (!/^[A-Z]\d{3}$/.test(brandCode)) continue;
    const livingBrand = BRAND_BY_CODE[brandCode];
    if (!livingBrand) { skippedNonLiving++; continue; }

    matchedLeafRows++;
    const store = normalizeStore(storeName);
    bump(perBrand, livingBrand); bump(perStore, store);
    for (const [idx, date] of dateAt) {
      const cell = (fields[idx] ?? "").trim();
      if (!cell || cell === "#####") continue;
      const n = Number(cell.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < MIN_SALES) continue;
      out.push(`${store}\t${livingBrand}\t${date}\t${Math.round(n)}`);
      cells++;
    }
  }

  writeFileSync(LONG_PATH, out.join("\n") + "\n", "utf8");
  console.log(`\n✅ leaf 행: ${matchedLeafRows} (LIVING_BRANDS 매치)`);
  console.log(`⏭  비-LIVING 코드 skip: ${skippedNonLiving} · aggregate skip: ${skippedAggregate}`);
  console.log(`📦 long-format 셀 수: ${cells} → ${LONG_PATH}`);
  console.log("\n브랜드별:");
  for (const [b, n] of [...perBrand.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${b.padEnd(8)} ${n} 행`);
  console.log(`\n지점 수: ${perStore.size}`);
}

// ── 공용: long TSV 파싱 ───────────────────────────────────────────────
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

async function loadPopups(sb, year, cols) {
  const { data, error } = await sb.from("living_popup").select(cols).eq("year", year);
  if (error) throw new Error(`living_popup 조회 실패: ${error.message}`);
  return data ?? [];
}

// ── report: 미매치 (브랜드,지점) 요약 ─────────────────────────────────
async function runReport() {
  const sb = makeSupabase();
  const rows = parseTsv(LONG_PATH)
    .map((r) => ({ ...r, store: normalizeStore(r.store), brand: normalizeBrand(r.brand) }))
    .filter((r) => LIVING_BRANDS.has(r.brand));

  const popups = await loadPopups(sb, YEAR, "id,brand,store,start_date,end_date");
  const popupsByKey = new Map();
  for (const p of popups) {
    const key = `${normalizeBrand(p.brand)}|${normalizeStore(p.store)}`;
    if (!popupsByKey.has(key)) popupsByKey.set(key, []);
    popupsByKey.get(key).push({ start: p.start_date, end: p.end_date });
  }

  const groups = new Map();
  for (const r of rows) {
    if (r.sales <= 0) continue;
    const cands = brandCandidatesFor(r.brand).flatMap((b) => popupsByKey.get(`${b}|${r.store}`) ?? []);
    if (cands.some((p) => inRange(r.date, p.start, p.end))) continue;
    const key = `${r.brand}|${r.store}`;
    if (!groups.has(key)) groups.set(key, { brand: r.brand, store: r.store, sum: 0, dates: new Set(), popupRanges: cands });
    const g = groups.get(key);
    g.sum += r.sales; g.dates.add(r.date);
  }

  const list = [...groups.values()].map((g) => ({
    ...g, dateCount: g.dates.size,
    minDate: [...g.dates].sort()[0], maxDate: [...g.dates].sort().pop(),
  })).sort((a, b) => b.sum - a.sum);

  console.log(`\n📊 미매치 (브랜드, 지점) 조합: ${list.length}개  ·  합계 ${list.reduce((t, g) => t + g.sum, 0).toLocaleString()}원\n`);
  console.log("브랜드      | 지점         | 일수 | 합계(원)         | 기간                    | 등록된 팝업 기간");
  console.log("-".repeat(140));
  for (const g of list) {
    const pr = g.popupRanges.length ? g.popupRanges.map((p) => `${p.start}~${p.end}`).join(", ") : "(없음)";
    console.log(`${g.brand.padEnd(8)} | ${g.store.padEnd(10)} | ${String(g.dateCount).padStart(3)} | ${g.sum.toLocaleString().padStart(15)} | ${g.minDate}~${g.maxDate} | ${pr}`);
  }
}

// ── import (기본) / dry ───────────────────────────────────────────────
async function runImport(dry) {
  const sb = makeSupabase();
  console.log(`📂 입력: ${LONG_PATH}`);
  console.log(`📅 연도: ${YEAR}${dry ? "  · dry-run" : ""}`);

  const rawRows = parseTsv(LONG_PATH);
  console.log(`📄 입력 행: ${rawRows.length}`);

  const popups = await loadPopups(sb, YEAR, "id,organization_id,brand,store,start_date,end_date,year");
  console.log(`🗄  living_popup(${YEAR}): ${popups.length}건`);
  const idx = new Map();
  for (const p of popups) {
    const key = `${normalizeBrand(p.brand)}|${normalizeStore(p.store)}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(p);
  }

  let skipNonLiving = 0, matched = 0, unmatched = 0, ambiguous = 0;
  const upserts = new Map();
  const affected = new Set();
  const unmatchedSamples = [], ambiguousSamples = [];

  for (const r of rawRows) {
    const brand = normalizeBrand(r.brand);
    if (!LIVING_BRANDS.has(brand)) { skipNonLiving++; continue; }
    if (r.sales <= 0) continue;

    const store = normalizeStore(r.store);
    const cands = brandCandidatesFor(brand)
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

    // 다중 매치 시 첫 번째 사용 — 같은 지점·브랜드 기간 겹침은 운영상 드묾.
    const popup = cands[0];
    const k = `${popup.organization_id}|${popup.id}|${r.date}`;
    const prev = upserts.get(k);
    upserts.set(k, { organization_id: popup.organization_id, popup_id: popup.id, date: r.date, sales: (prev?.sales ?? 0) + r.sales });
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
    console.log("\n  미매치 샘플: (전체 요약은 --report)");
    for (const u of unmatchedSamples) console.log(`   - ${u.brand} / ${u.store} / ${u.date} / ${u.sales.toLocaleString()}원`);
  }
  if (ambiguousSamples.length) {
    console.log("\n  다중매치 샘플:");
    for (const a of ambiguousSamples) console.log(`   - ${a.brand} / ${a.store} / ${a.date} → ${a.popupIds.join(", ")}`);
  }

  if (dry) { console.log("\n🛑 dry-run — DB 변경 없음."); return; }
  if (upserts.size === 0) { console.log("\n✋ upsert 대상이 없습니다."); return; }

  // 1) living_popup_daily upsert
  const rows = [...upserts.values()].map((r) => ({ ...r, sales: Math.round(r.sales) }));
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await sb.from("living_popup_daily").upsert(chunk, { onConflict: "popup_id,date" });
    if (error) throw new Error(`daily upsert 실패 @${i}: ${error.message}`);
    process.stdout.write(`\r  daily upsert ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log("\n  ✅ daily upsert 완료");

  // 2) 영향 팝업별 sales(백만) 재계산
  let recalc = 0;
  for (const popupId of affected) {
    const { data: drows, error } = await sb.from("living_popup_daily").select("sales").eq("popup_id", popupId);
    if (error) { console.error(`  합계 조회 실패(${popupId}):`, error.message); continue; }
    const totalWon = (drows ?? []).reduce((t, r) => t + Number(r.sales), 0);
    const totalMil = totalWon ? Math.round(totalWon / 1e6) : null;
    const { error: ue } = await sb.from("living_popup").update({ sales: totalMil }).eq("id", popupId);
    if (ue) { console.error(`  sales 갱신 실패(${popupId}):`, ue.message); continue; }
    recalc++;
    process.stdout.write(`\r  popup.sales 재계산 ${recalc}/${affected.size}`);
  }
  console.log(`\n  ✅ popup.sales ${recalc}건 재계산 완료`);
  console.log("\n🎉 import 완료");
}

// ── entry ─────────────────────────────────────────────────────────────
(async () => {
  if (MODE === "convert") return runConvert();
  if (MODE === "report") return runReport();
  return runImport(MODE === "dry");
})().catch((e) => { console.error("\n❌", e.message); process.exit(1); });
