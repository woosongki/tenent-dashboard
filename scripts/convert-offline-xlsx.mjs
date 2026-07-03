#!/usr/bin/env node
/**
 * 오프라인 매출 ERP 익스포트(xlsx) → Supabase import용 CSV 변환
 *
 * 5번 특정(누적) + 6번 특정(당월) 두 파일을 한 번에 처리.
 * 매월 ERP에서 새 xlsx 받으면 파일만 교체해 재실행.
 *
 * 실행:
 *   node scripts/convert-offline-xlsx.mjs
 *   node scripts/convert-offline-xlsx.mjs --cum "경로/5.특정(누적)_DB.xlsx" --month "경로/6.특정(당월)_DB.xlsx" --month-ym 2026-07
 *
 * 기본 경로(인자 없을 때): 바탕 화면 표준 파일명
 *   누적: ~/OneDrive/바탕 화면/5.특정(누적)_DB.xlsx
 *   당월: ~/OneDrive/바탕 화면/6.특정(당월)_DB.xlsx
 *
 * 출력(같은 폴더):
 *   sales_offline_cum.csv    (division,cat,brand,store,period,sales,gp,area_raw,store_cnt)
 *   sales_offline_month.csv
 *
 * 옵션:
 *   --month-ym  당월 기준월(YYYY-MM). 기본 2026-06. 매월 바꿔줄 것.
 *   --cum-year  누적 기준연도. 기본 2026.
 *   --days-cum  누적 평당 일수(전용면적 평 환산용). 기본 181 (1~6월).
 *   --days-month 당월 평당 일수. 기본 30.
 *
 * 동작:
 *   - "매출비교(브랜드)" 시트: 지점 leaf 행 → 당기(2026)·전기(2025) 매출·이익
 *   - "평당(지점)" 시트: 전용면적(평·일)·매장수 → (지점|복종|브랜드)로 조인
 *   - division 분류: B*=패션, EDA/EHA=F&B, 나머지 E·F=기타, I*=온라인
 */

import XLSX from "xlsx";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const DESKTOP = path.join(os.homedir(), "OneDrive", "바탕 화면");
const CUM_XLSX   = arg("--cum")   ?? path.join(DESKTOP, "5.특정(누적)_DB.xlsx");
const MONTH_XLSX = arg("--month") ?? path.join(DESKTOP, "6.특정(당월)_DB.xlsx");
const OUT_DIR    = arg("--out")   ?? DESKTOP;
const CUM_YEAR   = arg("--cum-year", "2026");
const MONTH_YM   = arg("--month-ym", "2026-06");
const DAYS_CUM   = Number(arg("--days-cum", "181"));
const DAYS_MONTH = Number(arg("--days-month", "30"));

// 구매그룹 코드 → 부문
function divisionOf(code) {
  if (!code) return "기타";
  if (code[0] === "I") return "온라인";
  if (code === "EDA" || code === "EHA") return "F&B";
  if (code[0] === "B") return "패션";
  return "기타"; // E*, F*
}
function findHeader(rows, first) {
  for (let i = 0; i < 8; i++) if (rows[i] && rows[i][0] === first) return i;
  return -1;
}

// 평당(지점) 시트 → (지점|복종|브랜드) → {areaRaw, cnt}
function parsePyeong(ws) {
  if (!ws) return new Map();
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const h = findHeader(rows, "플랜트");
  const map = new Map();
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const store = r[1], cat = r[3], bcode = r[4], bname = r[5];
    if (!store || !bname || !bcode || bcode === "결과") continue;
    // ERP 잡행 차단: "지정되지 않음"·"#"(소계/미분류) — build-sales.mjs와 동일 규칙
    if (bname === "지정되지 않음" || bcode === "#") continue;
    // area_raw/store_cnt은 DB bigint 컬럼이므로 CSV 직접 import에서도 실패하지 않도록 반올림.
    map.set(`${store}|${cat}|${bname}`, { areaRaw: Math.round(Number(r[7] || 0)), cnt: Math.round(Number(r[10] || 0)) });
  }
  return map;
}

// 매출비교(브랜드) 시트 → leaf 행
function parseMain(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const h = findHeader(rows, "구매그룹(Now:손익센터)");
  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const gcode = r[0], cat = r[1], bname = r[3], scode = r[4], sname = r[5];
    if (!sname || !scode || scode === "결과" || !String(scode).includes("/") || !bname) continue;
    // ERP 잡행 차단: "지정되지 않음" — build-sales.mjs와 동일 규칙
    // (매출비교 시트는 brand_code 컬럼 위치가 불확실해 brand_name만 필터)
    if (bname === "지정되지 않음") continue;
    out.push({
      division: divisionOf(gcode), cat: String(cat || "").trim(),
      brand: String(bname).trim(), store: String(sname).trim(),
      sCur: Math.round(Number(r[6] || 0)), sPrev: Math.round(Number(r[7] || 0)),
      gCur: Math.round(Number(r[9] || 0)), gPrev: Math.round(Number(r[10] || 0)),
    });
  }
  return out;
}

function csvEsc(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 시트명에서 평당 시트 자동 탐색 ("26년...평당(지점)", "25년...평당(지점)")
function findPyeongSheet(wb, yy) {
  return wb.SheetNames.find((n) => n.includes(`${yy}년`) && n.includes("평당") && n.includes("지점"));
}
function findMainSheet(wb) {
  return wb.SheetNames.find((n) => n.includes("매출비교") && n.includes("브랜드"));
}

function build(file, periodCur, periodPrev, days, outName) {
  if (!fs.existsSync(file)) { console.log(`⏭  파일 없음: ${file}`); return; }
  const wb = XLSX.readFile(file);
  const mainSheet = findMainSheet(wb);
  const yyCur = periodCur.slice(2, 4);      // '26'
  const yyPrev = String(Number(yyCur) - 1).padStart(2, "0"); // '25'
  const main = parseMain(wb.Sheets[mainSheet]);
  const aCur = parsePyeong(wb.Sheets[findPyeongSheet(wb, yyCur)]);
  const aPrev = parsePyeong(wb.Sheets[findPyeongSheet(wb, yyPrev)]);

  const rows = [];
  for (const r of main) {
    const k = `${r.store}|${r.cat}|${r.brand}`;
    const pc = aCur.get(k), pp = aPrev.get(k);
    if (r.sCur || r.gCur) rows.push([r.division, r.cat, r.brand, r.store, periodCur, r.sCur, r.gCur, pc ? pc.areaRaw : 0, pc ? pc.cnt : 0]);
    if (r.sPrev || r.gPrev) rows.push([r.division, r.cat, r.brand, r.store, periodPrev, r.sPrev, r.gPrev, pp ? pp.areaRaw : 0, pp ? pp.cnt : 0]);
  }
  const header = "division,cat,brand,store,period,sales,gp,area_raw,store_cnt";
  const out = path.join(OUT_DIR, outName);
  fs.writeFileSync(out, "﻿" + [header, ...rows.map((r) => r.map(csvEsc).join(","))].join("\r\n"), "utf8");

  const sumCur = main.reduce((t, r) => t + r.sCur, 0);
  const matched = main.filter((r) => aCur.has(`${r.store}|${r.cat}|${r.brand}`)).length;
  console.log(`✅ ${outName}: ${rows.length}행 (당기 매출합 ${sumCur.toLocaleString()}, 평당매칭 ${matched}/${main.length})`);
}

console.log("── 오프라인 매출 xlsx → CSV 변환 ──\n");
console.log(`🏆 누적: ${CUM_XLSX} (period=${CUM_YEAR}, 평당일수=${DAYS_CUM})`);
build(CUM_XLSX, CUM_YEAR, String(Number(CUM_YEAR) - 1), DAYS_CUM, "sales_offline_cum.csv");
console.log(`📅 당월: ${MONTH_XLSX} (period=${MONTH_YM}, 평당일수=${DAYS_MONTH})`);
const prevYm = `${Number(MONTH_YM.slice(0, 4)) - 1}${MONTH_YM.slice(4)}`;
build(MONTH_XLSX, MONTH_YM, prevYm, DAYS_MONTH, "sales_offline_month.csv");

console.log("\n🎉 완료 — 출력 폴더의 CSV를 import 하세요.");
console.log("   재사용 import: node scripts/import-sales.mjs (또는 Supabase Table Editor)");
