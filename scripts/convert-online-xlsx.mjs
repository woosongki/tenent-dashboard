#!/usr/bin/env node
/**
 * 온라인 매출 ERP 익스포트(xlsx) → Supabase import용 CSV 변환
 *
 * 8번 온라인(누적) + 9번 온라인(당월) 두 파일을 한 번에 처리.
 * 매월 ERP에서 새 xlsx 받으면 파일만 교체해 재실행.
 *
 * 실행:
 *   node scripts/convert-online-xlsx.mjs
 *   node scripts/convert-online-xlsx.mjs --month "경로/9.온라인(당월)_DB.xlsx" --cum "경로/8.온라인(누적)_DB.xlsx"
 *
 * 기본 경로(인자 없을 때): 바탕 화면의 표준 파일명
 *   당월: ~/OneDrive/바탕 화면/9.온라인(당월)_DB.xlsx
 *   누적: ~/OneDrive/바탕 화면/8.온라인(누적)_DB.xlsx
 *
 * 출력(같은 폴더):
 *   sales_online_monthly.csv  (division,cat,brand,store,channel,ym,sales)
 *   sales_online_cum.csv      (division,cat,brand,store,channel,year,sales)
 *
 * 동작:
 *   - "_지점" 시트만 사용 (지점×브랜드×채널 최대 상세)
 *   - 채널명은 헤더 행에서 동적 추출 → 연도별 채널 구성 차이 자동 대응
 *   - leaf 행만 (소계/전체결과 제외), 값 0/null 제외
 *   - division="패션" 고정 (온라인 ERP는 패션 부문), GP 미관리
 *
 * 검증: 변환 후 전체 합계를 콘솔에 출력 (원본 "전체 결과" 행과 대조)
 */

import XLSX from "xlsx";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ── 인자 파싱 ──
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const DESKTOP = path.join(os.homedir(), "OneDrive", "바탕 화면");
const MONTH_XLSX = arg("--month") ?? path.join(DESKTOP, "9.온라인(당월)_DB.xlsx");
const CUM_XLSX   = arg("--cum")   ?? path.join(DESKTOP, "8.온라인(누적)_DB.xlsx");
const OUT_DIR    = arg("--out")   ?? DESKTOP;

// ── 시트명 → 기간 라벨 추출 ──
// "26년 6월 당월_지점" → ym "2026-06"  /  "26년 누적_지점" → year "2026"
function parseMonthYm(sheetName) {
  const m = sheetName.match(/(\d{2})년\s*(\d{1,2})월/);
  if (!m) return null;
  return `20${m[1]}-${String(m[2]).padStart(2, "0")}`;
}
function parseYear(sheetName) {
  const m = sheetName.match(/(\d{2})년/);
  return m ? `20${m[1]}` : null;
}

/** 지점 시트 1개 파싱 → leaf 행 배열 */
function parseStoreSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // 채널명 행 찾기: 어느 컬럼에든 알려진 채널명이 처음 등장하는 행.
  // ERP 익스포트가 컬럼 위치를 옮겨도(예: 26년 6월부터 채널이 8→10 이동) 자동 적응.
  const CHAN_RE = /쿠팡|네이버|11번가|G마켓|옥션|통합몰|하프클럽|E몰|패션플러스/;
  let chanRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] || [];
    if (r.some((v) => typeof v === "string" && CHAN_RE.test(v))) { chanRowIdx = i; break; }
  }
  if (chanRowIdx < 0) throw new Error("채널명 헤더 행을 찾지 못함");
  const chanRow = rows[chanRowIdx];
  // 실제 채널 컬럼만 — "지정되지 않음"/"결과"/"#" 같은 소계·미분류 열은 제외.
  const channels = {};
  for (let c = 0; c < chanRow.length; c++) {
    const v = chanRow[c];
    if (!v || typeof v !== "string") continue;
    const t = v.trim();
    if (!t || t === "지정되지 않음" || t === "결과" || t === "#") continue;
    if (!CHAN_RE.test(t)) continue;
    channels[c] = t;
  }
  if (Object.keys(channels).length === 0) throw new Error("채널 컬럼을 추출하지 못함");

  const out = [];
  for (let i = chanRowIdx + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const store = r[1], cat = r[3], bCode = r[4], bName = r[5];
    if (!bName || !bCode || bCode === "결과") continue;       // leaf 아님(소계)
    if (!store || store === "전체 결과") continue;
    for (const [c, ch] of Object.entries(channels)) {
      const v = r[c];
      if (v == null || v === 0) continue;
      out.push({
        division: "패션",
        cat: String(cat || "").trim(),
        brand: String(bName).trim(),
        store: String(store).trim(),
        channel: ch,
        sales: Math.round(Number(v)),
      });
    }
  }
  return out;
}

function csvEsc(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file, header, rows, cols) {
  const lines = [header, ...rows.map((r) => cols.map((c) => csvEsc(r[c])).join(","))];
  fs.writeFileSync(file, "﻿" + lines.join("\r\n"), "utf8");
}

// ── 당월 처리 ──
function processMonth() {
  if (!fs.existsSync(MONTH_XLSX)) { console.log(`⏭  당월 파일 없음: ${MONTH_XLSX}`); return; }
  const wb = XLSX.readFile(MONTH_XLSX);
  const sheets = wb.SheetNames.filter((n) => n.includes("_지점"));
  let all = [];
  for (const name of sheets) {
    const ym = parseMonthYm(name);
    if (!ym) { console.log(`  ⚠ 월 파싱 실패: ${name}`); continue; }
    const rows = parseStoreSheet(wb.Sheets[name]).map((r) => ({ ...r, ym }));
    const sum = rows.reduce((t, r) => t + r.sales, 0);
    console.log(`  [${name}] ${rows.length}행, 합계 ${sum.toLocaleString()} (ym=${ym})`);
    all = all.concat(rows);
  }
  const out = path.join(OUT_DIR, "sales_online_monthly.csv");
  writeCsv(out, "division,cat,brand,store,channel,ym,sales", all,
    ["division", "cat", "brand", "store", "channel", "ym", "sales"]);
  console.log(`✅ 당월 ${all.length}행 → ${out}\n`);
}

// ── 누적 처리 ──
function processCum() {
  if (!fs.existsSync(CUM_XLSX)) { console.log(`⏭  누적 파일 없음: ${CUM_XLSX}`); return; }
  const wb = XLSX.readFile(CUM_XLSX);
  const sheets = wb.SheetNames.filter((n) => n.includes("_지점"));
  let all = [];
  for (const name of sheets) {
    const year = parseYear(name);
    if (!year) { console.log(`  ⚠ 연도 파싱 실패: ${name}`); continue; }
    const rows = parseStoreSheet(wb.Sheets[name]).map((r) => ({ ...r, year }));
    const sum = rows.reduce((t, r) => t + r.sales, 0);
    console.log(`  [${name}] ${rows.length}행, 합계 ${sum.toLocaleString()} (year=${year})`);
    all = all.concat(rows);
  }
  const out = path.join(OUT_DIR, "sales_online_cum.csv");
  writeCsv(out, "division,cat,brand,store,channel,year,sales", all,
    ["division", "cat", "brand", "store", "channel", "year", "sales"]);
  console.log(`✅ 누적 ${all.length}행 → ${out}\n`);
}

console.log("── 온라인 매출 xlsx → CSV 변환 ──\n");
console.log("📱 당월:", MONTH_XLSX);
processMonth();
console.log("🛒 누적:", CUM_XLSX);
processCum();
console.log("🎉 완료 — 출력 폴더의 CSV를 Supabase Table Editor로 import 하세요.");
console.log("   (재import 전 기존 행 삭제: TRUNCATE sales_online_monthly; / sales_online_cum;)");
