#!/usr/bin/env node
/**
 * 5.특정(누적)_DB 신규 포맷 파일 dry-run 검증 — 실제 UI 확정 전에 파서 예상 결과를 확인.
 *
 * 사용:
 *   node scripts/verify-offline-monthly-hist.mjs "<xlsx 경로>"
 *
 * src/lib/sales/ingest.ts 의 buildOfflineMonthlyHistRows 와 동일한 규칙을 mjs 로 재현.
 * 검증 항목: 필요 시트 존재 · 감지 연도·월 · 예상 행 수 · 매출/이익 합계 · 매출 시트1 vs 시트3 대조.
 */

import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("사용: node scripts/verify-offline-monthly-hist.mjs <xlsx>"); process.exit(1); }

const won = (n) => Math.round(n).toLocaleString("ko-KR");
const eok = (n) => (n / 1e8).toFixed(1);

const buf = readFileSync(file);
const wb = XLSX.read(buf, { type: "buffer" });

console.log(`\n📂 ${file}`);
console.log(`시트 ${wb.SheetNames.length}개: ${wb.SheetNames.join(" · ")}`);

const mainName = wb.SheetNames.find((n) => n.includes("누적매출비교") && n.includes("브랜드"));
const p26 = wb.SheetNames.find((n) => n.includes("26년") && n.includes("누적평당") && n.includes("브랜드"));
const p25 = wb.SheetNames.find((n) => n.includes("25년") && n.includes("누적평당") && n.includes("브랜드"));
if (!mainName) { console.error("❌ ‘누적매출비교(브랜드)’ 시트 없음"); process.exit(1); }
console.log(`\n필요 시트 감지:`);
console.log(`  · 매출/이익 원본 → ${mainName}`);
console.log(`  · 26 면적/매장수 → ${p26 ?? "(없음)"}`);
console.log(`  · 25 면적/매장수 → ${p25 ?? "(없음)"}`);

function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function divisionOf(code) {
  if (!code) return "기타";
  if (code[0] === "I") return "온라인";
  if (code === "EDA" || code === "EHA") return "F&B";
  if (code[0] === "B") return "패션";
  return "기타";
}

function normHistMetric(s, kind) {
  const t = s.replace(/\s+/g, "");
  if (kind === "main") {
    if (t === "총매출액") return "sales";
    if (t === "매출총이익") return "gp";
    return null;
  }
  if (t === "전용면적") return "area";
  if (t === "매장수") return "store_cnt";
  return null;
}

function parseHistSheet(ws, kind) {
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  let h = -1;
  for (let i = 0; i < 12; i++) {
    const v = rows[i]?.[0];
    if (typeof v === "string" && (v.startsWith("구매그룹") || v === "플랜트")) { h = i; break; }
  }
  if (h < 0) return [];
  const labelRow = rows[h];
  let groupCol = -1, brandCol = -1, storeCol = -1;
  for (let c = 0; c < labelRow.length; c++) {
    const v = labelRow[c];
    if (typeof v !== "string") continue;
    if (groupCol < 0 && v.startsWith("구매그룹")) groupCol = c;
    else if (brandCol < 0 && (v === "브랜드" || v.startsWith("브랜드"))) brandCol = c;
    else if (storeCol < 0 && (v === "플랜트" || v.startsWith("지점"))) storeCol = c;
  }
  if (groupCol < 0 || brandCol < 0 || storeCol < 0) return [];

  const cols = [];
  const width = Math.max(...[h - 3, h - 2, h - 1].map((r) => rows[r]?.length ?? 0));
  for (let c = 6; c < width; c++) {
    if (kind === "main") {
      const mr = rows[h - 3]?.[c], pr = rows[h - 2]?.[c], mo = rows[h - 1]?.[c];
      if (typeof mr !== "string" || typeof pr !== "string" || mo == null) continue;
      if (pr.includes("성장율")) continue;
      const ym4 = pr.match(/^(\d{4})-\d{2}-\d{2}$/);
      if (!ym4) continue;
      const month = String(mo).replace(/\s+/g, "");
      if (!/^\d{1,2}$/.test(month)) continue;
      const metric = normHistMetric(mr, "main");
      if (!metric) continue;
      cols.push({ metric, ym: `${ym4[1]}-${String(Number(month)).padStart(2, "0")}`, col: c });
    } else {
      const mr = rows[h - 2]?.[c], ymRaw = rows[h - 1]?.[c];
      if (typeof mr !== "string" || ymRaw == null) continue;
      const ymStr = String(ymRaw).trim();
      if (!/^\d{4}-\d{2}$/.test(ymStr)) continue;
      const metric = normHistMetric(mr, "pyeong");
      if (!metric) continue;
      cols.push({ metric, ym: ymStr, col: c });
    }
  }

  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const gCode = r[groupCol], gName = r[groupCol + 1];
    const bCode = r[brandCol], bName = r[brandCol + 1];
    const sCode = r[storeCol], sName = r[storeCol + 1];
    if (!bName || bCode === "결과" || bName === "지정되지 않음" || bCode === "#") continue;
    if (!sName || sCode === "결과" || sName === "전체 결과" || sCode === "#") continue;
    const division = divisionOf(String(gCode || ""));
    const cat = String(gName || "").trim();
    const brand = String(bName).trim();
    const store = String(sName).trim();

    const byYm = new Map();
    for (const cd of cols) {
      const v = Number(r[cd.col] ?? 0);
      if (!v) continue;
      const e = byYm.get(cd.ym) ?? {};
      e[cd.metric] = v;
      byYm.set(cd.ym, e);
    }
    for (const [ym, v] of byYm) out.push({ division, cat, brand, store, ym, ...v });
  }
  return out;
}

const mainRows = parseHistSheet(wb.Sheets[mainName], "main");
const pyeongRows = [
  ...parseHistSheet(wb.Sheets[p26 ?? ""], "pyeong"),
  ...parseHistSheet(wb.Sheets[p25 ?? ""], "pyeong"),
];

console.log(`\n원시 leaf 행:`);
console.log(`  · 매출/이익(시트1) → ${won(mainRows.length)}행`);
console.log(`  · 면적/매장수(시트3+5) → ${won(pyeongRows.length)}행`);

const areaMap = new Map();
for (const r of pyeongRows) {
  const k = `${r.division}|${r.cat}|${r.brand}|${r.store}|${r.ym}`;
  const e = areaMap.get(k) ?? {};
  if (r.area != null) e.area = r.area;
  if (r.store_cnt != null) e.store_cnt = r.store_cnt;
  areaMap.set(k, e);
}

const rows = [];
let noArea = 0;
for (const r of mainRows) {
  const sales = r.sales ?? 0, gp = r.gp ?? 0;
  if (!sales && !gp) continue;
  const k = `${r.division}|${r.cat}|${r.brand}|${r.store}|${r.ym}`;
  const a = areaMap.get(k);
  if (!a?.area) noArea++;
  const days = daysInMonth(r.ym);
  rows.push({
    ...r,
    year: r.ym.slice(0, 4),
    sales: Math.round(sales), gp: Math.round(gp),
    area_raw: Math.round((a?.area ?? 0) * days),
    store_cnt: Math.round(a?.store_cnt ?? 0),
  });
}

console.log(`\n📊 최종 예상 적재 행: ${won(rows.length)}행`);
if (noArea) console.log(`  ⚠ 면적 미매칭: ${won(noArea)}행 (dpp매출 0 표시됨)`);

const byYear = new Map();
for (const r of rows) {
  const y = r.year;
  const e = byYear.get(y) ?? { count: 0, months: new Set(), sales: 0, gp: 0 };
  e.count++; e.months.add(r.ym); e.sales += r.sales; e.gp += r.gp;
  byYear.set(y, e);
}

console.log(`\n연도별 요약:`);
for (const [y, e] of [...byYear.entries()].sort()) {
  const mm = [...e.months].sort();
  console.log(`  · ${y}년 · ${mm.length}개월 (${mm[0]}~${mm[mm.length-1]}) · ${won(e.count)}행 · 매출 ${eok(e.sales)}억 · 이익 ${eok(e.gp)}억`);
}

console.log(`\n월별 매출 (${[...byYear.keys()].sort().slice(-1)[0]}년):`);
const latestYear = [...byYear.keys()].sort().slice(-1)[0];
const byYm = new Map();
for (const r of rows) {
  if (r.year !== latestYear) continue;
  const e = byYm.get(r.ym) ?? { sales: 0, gp: 0, cnt: 0 };
  e.sales += r.sales; e.gp += r.gp; e.cnt++;
  byYm.set(r.ym, e);
}
for (const [ym, e] of [...byYm.entries()].sort()) {
  console.log(`  · ${ym} · ${won(e.cnt)}행 · 매출 ${eok(e.sales)}억 · 이익 ${eok(e.gp)}억`);
}

console.log(`\n✅ dry-run 완료 — 이 결과가 예상과 맞으면 5·M 카드 확정 진행.\n`);
