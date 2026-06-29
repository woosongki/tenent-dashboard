#!/usr/bin/env node
/**
 * 리빙 일매출 import — 미매치 (브랜드, 지점) 요약.
 *
 * import-living-popup-daily.mjs 와 동일한 매칭 규칙으로 돌리되,
 * 매치 안 된 daily 행을 (브랜드, 지점) 단위로 합쳐서 표시한다.
 *   - 합계 매출(원)
 *   - 최초/최종 일자
 *   - 일자 수
 *   - 같은 (브랜드, 지점) 으로 등록된 팝업 기간(있다면) — "기간만 안 맞는" 케이스 구별
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
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const IN_PATH = path.join(ROOT, "data", "raw", "living-popup-daily-2026.tsv");
const YEAR = 2026;

const LIVING_BRANDS = new Set(["락앤락","글라스락","알리페즈","광인상사","테팔","수앤지","하우담","아르페지오","커스티","이브자리","쿡셀","몽드블랑","지포트리","파고","쿤리콘","정인","포트메리온"]);
const BRAND_ALIAS = { "쿤리쿤":"쿤리콘", "수엔지":"수앤지" };
const UMBRELLA_BRANDS = { "포트메리온": ["포트메리온","광인상사","하우담","몽드블랑"] };
const brandCandidatesFor = (b) => UMBRELLA_BRANDS[b] ?? [b];
const STORES = new Set(["강남점","중계점","불광점","야탑점","산본점","분당점","덕천점","고잔점","강서점","천호2점","송파점","평촌2점","평택점","안양점","창원점","수성점","해운대점","부천점","부평점","동수원","일산점","인천점","울산2점","강북점","광명점","대전 유성점","울산점","경산점","충장점","부산대점","중앙로역점","순천점","청주점","신구로점","광주역점","수원터미널점","엑스코점","전주점","괴정점","구미점","쇼핑점"]);
const STORE_ALIAS = { "수터":"수원터미널점","터미널":"수원터미널점","유성":"대전 유성점","NC대전 유성점":"대전 유성점","NC대전유성점":"대전 유성점","평촌":"평촌2점","천호":"천호2점","울산":"울산점" };
const normalizeBrand = (b) => BRAND_ALIAS[(b ?? "").trim()] ?? (b ?? "").trim();
function normalizeStore(s) {
  const t = (s ?? "").trim();
  if (STORE_ALIAS[t]) return STORE_ALIAS[t];
  if (STORES.has(t)) return t;
  const w = `${t}점`;
  if (STORES.has(w)) return w;
  return t;
}

// load daily TSV
const txt = readFileSync(IN_PATH, "utf8").replace(/^﻿/, "");
const lines = txt.split(/\r?\n/).filter(l => l.trim());
const head = lines[0].split("\t").map(s => s.trim().toLowerCase());
const ci = Object.fromEntries(head.map((h,i) => [h,i]));
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const v = lines[i].split("\t");
  const store = normalizeStore(v[ci.store]);
  const brand = normalizeBrand(v[ci.brand]);
  const date = v[ci.date]?.trim();
  const sales = Number(String(v[ci.sales] ?? "").replace(/[,\s]/g,""));
  if (!store || !brand || !date || !Number.isFinite(sales)) continue;
  if (!LIVING_BRANDS.has(brand)) continue;
  rows.push({ store, brand, date, sales });
}

// load popups
const { data: popups, error } = await sb.from("living_popup").select("id,brand,store,start_date,end_date").eq("year", YEAR);
if (error) { console.error("DB 조회 실패:", error.message); process.exit(1); }
const popupsByKey = new Map(); // brand|store -> [{start,end},...]
for (const p of popups ?? []) {
  const key = `${normalizeBrand(p.brand)}|${normalizeStore(p.store)}`;
  if (!popupsByKey.has(key)) popupsByKey.set(key, []);
  popupsByKey.get(key).push({ start: p.start_date, end: p.end_date });
}

// classify unmatched
const inRange = (d, s, e) => d >= s && d <= e;
const groups = new Map(); // brand|store -> {brand, store, sum, dates: Set, popupRanges: []}
for (const r of rows) {
  if (r.sales <= 0) continue;
  const brandsToTry = brandCandidatesFor(r.brand);
  const cands = brandsToTry.flatMap(b => popupsByKey.get(`${b}|${r.store}`) ?? []);
  const matched = cands.some(p => inRange(r.date, p.start, p.end));
  if (matched) continue;
  const key = `${r.brand}|${r.store}`;
  if (!groups.has(key)) groups.set(key, { brand: r.brand, store: r.store, sum: 0, dates: new Set(), popupRanges: cands });
  const g = groups.get(key);
  g.sum += r.sales;
  g.dates.add(r.date);
}

const list = [...groups.values()].map(g => ({
  ...g,
  dateCount: g.dates.size,
  minDate: [...g.dates].sort()[0],
  maxDate: [...g.dates].sort().pop(),
})).sort((a,b) => b.sum - a.sum);

console.log(`\n📊 미매치 (브랜드, 지점) 조합: ${list.length}개  ·  합계 ${list.reduce((t,g)=>t+g.sum,0).toLocaleString()}원\n`);
console.log("브랜드      | 지점         | 일수 | 합계(원)         | 기간                    | 등록된 팝업 기간");
console.log("-".repeat(140));
for (const g of list) {
  const popups = g.popupRanges.length ? g.popupRanges.map(p => `${p.start}~${p.end}`).join(", ") : "(없음)";
  console.log(
    `${g.brand.padEnd(8)} | ${g.store.padEnd(10)} | ${String(g.dateCount).padStart(3)} | ${g.sum.toLocaleString().padStart(15)} | ${g.minDate}~${g.maxDate} | ${popups}`
  );
}
