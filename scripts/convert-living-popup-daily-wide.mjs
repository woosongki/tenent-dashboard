#!/usr/bin/env node
/**
 * 리빙 일매출 wide-format → long-format 변환.
 *
 * 입력: data/raw/living-popup-daily-2026.wide.tsv (ERP에서 붙여넣은 wide 표)
 *   - 행: 지점×브랜드 (R001/CODE, store, EFA, 가정문화, brand_code, brand_name, total, d1..d179)
 *   - 열: 전체 결과 + 일자 179개
 *
 * 출력: data/raw/living-popup-daily-2026.tsv (long-format)
 *   store\tbrand\tdate\tsales
 *
 * 규칙:
 *   - brand_code가 LIVING_BRANDS 16개 중 알려진 코드와 매칭되는 leaf 행만 사용
 *   - "결과"/"#"/aggregate 행 skip
 *   - 10만원 이하 / 음수 / 빈셀 skip
 *   - 지점명 NC대전 유성점 → 대전 유성점 정규화
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN_PATH  = path.join(ROOT, "data", "raw", "living-popup-daily-2026.wide.tsv");
const OUT_PATH = path.join(ROOT, "data", "raw", "living-popup-daily-2026.tsv");

// ERP 브랜드 코드 → canonical LIVING 브랜드명.
// 포트메리온(I050)은 광인상사/하우담/몽드블랑의 우산 표기로, importer에서 분기 매칭.
// 하우담 단독 ERP 코드는 미확인.
const BRAND_BY_CODE = {
  H499: "락앤락",
  I102: "글라스락",
  H625: "알리페즈",
  I301: "테팔",
  H545: "수앤지",
  H636: "아르페지오",
  H773: "커스티",
  H991: "이브자리",
  I664: "쿡셀",
  H594: "지포트리",
  I506: "파고",
  H626: "쿤리콘",
  H578: "정인",
  I050: "포트메리온",
};

const STORE_ALIAS = {
  "NC대전 유성점": "대전 유성점",
  "NC대전유성점":  "대전 유성점",
};
function normalizeStore(s) {
  const t = (s ?? "").trim();
  return STORE_ALIAS[t] ?? t;
}

const MIN_SALES = 100_000; // 10만원 이하는 무시 (오기/리턴 노이즈 거름)

const raw = readFileSync(IN_PATH, "utf8").replace(/^﻿/, "");
const lines = raw.split(/\r?\n/);

// 분리자 자동 감지 — Excel 붙여넣기는 보통 탭. 안전하게 탭 우선, 실패시 다중 공백.
function pickSplitter(line) {
  if (line.includes("\t")) return /\t/;
  return / {2,}/;
}

// 날짜 헤더 행 찾기
let dateRow = null;
let splitter = null;
for (const ln of lines) {
  if (ln.includes("2026-01-01") && ln.includes("2026-06-28")) {
    splitter = pickSplitter(ln);
    dateRow = ln.split(splitter);
    break;
  }
}
if (!dateRow) {
  console.error("❌ 날짜 헤더 행을 찾지 못했습니다. (2026-01-01 ~ 2026-06-28 포함 행 필요)");
  process.exit(1);
}

// 각 열이 어느 날짜인지 인덱싱
const dateAt = []; // [idx, "YYYY-MM-DD"]
for (let i = 0; i < dateRow.length; i++) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRow[i])) dateAt.push([i, dateRow[i]]);
}
console.log(`📅 일자 컬럼 ${dateAt.length}개 (${dateAt[0][1]} ~ ${dateAt[dateAt.length - 1][1]})`);

const out = ["store\tbrand\tdate\tsales"];
let matchedLeafRows = 0;
let skippedNonLiving = 0;
let skippedAggregate = 0;
let cells = 0;
const perBrand = new Map();
const perStore = new Map();

function bump(map, k) { map.set(k, (map.get(k) ?? 0) + 1); }

for (const ln of lines) {
  if (!ln.trim()) continue;
  const fields = ln.split(splitter);
  // 데이터 행 최소 길이 휴리스틱 — 헤더/요약행 회피
  if (fields.length < 50) continue;

  // 데이터 행 모양: [code, store, group(EFA), category(가정문화), brand_code, brand_name, total, ...dates]
  // aggregate 행은 brand_code 자리에 "결과" 또는 "#"
  const storeName = (fields[1] ?? "").trim();
  const brandCode = (fields[4] ?? "").trim();
  const brandName = (fields[5] ?? "").trim();

  if (!storeName || !brandCode) continue;
  if (brandCode === "결과" || brandCode === "#") { skippedAggregate++; continue; }
  // brand_code 모양: [A-Z]\d{3}/[A-Z]\d{3} ish
  if (!/^[A-Z]\d{3}$/.test(brandCode)) continue;

  const livingBrand = BRAND_BY_CODE[brandCode];
  if (!livingBrand) { skippedNonLiving++; continue; }

  matchedLeafRows++;
  bump(perBrand, livingBrand);
  bump(perStore, normalizeStore(storeName));

  const store = normalizeStore(storeName);
  for (const [idx, date] of dateAt) {
    const cell = (fields[idx] ?? "").trim();
    if (!cell || cell === "#####") continue;
    const n = Number(cell.replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (n < MIN_SALES) continue;
    out.push(`${store}\t${livingBrand}\t${date}\t${Math.round(n)}`);
    cells++;
  }
}

writeFileSync(OUT_PATH, out.join("\n") + "\n", "utf8");

console.log("");
console.log(`✅ leaf 행: ${matchedLeafRows} (LIVING_BRANDS 매치)`);
console.log(`⏭  비-LIVING 브랜드 코드 행 skip: ${skippedNonLiving}`);
console.log(`⏭  aggregate(결과/#) 행 skip: ${skippedAggregate}`);
console.log(`📦 long-format 셀 수: ${cells} → ${OUT_PATH}`);
console.log("");
console.log("브랜드별:");
for (const [b, n] of [...perBrand.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`   ${b.padEnd(8)} ${n} 행`);
}
console.log("");
console.log(`지점 수: ${perStore.size}`);
