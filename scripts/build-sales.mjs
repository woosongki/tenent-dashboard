#!/usr/bin/env node
/**
 * 매출분석 데이터 빌드 — 26년 1~5월 누적 (구매그룹 / 지점 / 브랜드 3축)
 *
 * 입력 (cp949/euc-kr):
 *   data/raw/sales-2026-05/group-brand.csv  (구매그룹 × 브랜드, 전사·월별 포함)
 *   data/raw/sales-2026-05/store-brand.csv  (지점 × 브랜드)
 * 출력:
 *   data/sales/brand-sales.json
 *
 * 규칙:
 *   - 지점은 41개 마스터(src/data/homeplus.ts ELAND_STORES)만 사용.
 *     비마스터 지점(당산·안산·논현 등) 제외.
 *   - 브랜드 "지정되지 않음"(#), "결과"(소계) 행은 브랜드로 취급하지 않음.
 *   - 컬럼: col4~9 = 누적(매출 2026/2025/성장 + 이익 2026/2025/성장)
 *           col10~39 = 2025년 1~5월 월별, col40~69 = 2026년 1~5월 월별
 *
 * 실행: node scripts/build-sales.mjs
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── 기준월 인자 (--month YYYY-MM, 기본 2026-05) ──
//   매월: data/raw/sales-YYYY-MM/{group-brand,store-brand}.csv 만 교체 후
//   node scripts/build-sales.mjs --month 2026-06
function argv(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const MONTH = argv("--month", "2026-05");
if (!/^\d{4}-\d{2}$/.test(MONTH)) { console.error(`❌ --month 형식 오류: ${MONTH} (YYYY-MM)`); process.exit(1); }
const [Y, M] = MONTH.split("-").map(Number);
const lastDay = new Date(Y, M, 0).getDate();          // 해당 월 말일
const mmEnd = String(lastDay).padStart(2, "0");
const mm = String(M).padStart(2, "0");
const PERIOD1 = `${Y}-01-01 - ${Y}-${mm}-${mmEnd}`;
const PERIOD2 = `${Y - 1}-01-01 - ${Y - 1}-${mm}-${mmEnd}`;
const SRC_LABEL = `라이프스타일 ${M}월누적 실적 (구매그룹·브랜드 / 지점·브랜드)`;

const SRC_DIR = path.join(ROOT, `data/raw/sales-${MONTH}`);
const F1 = path.join(SRC_DIR, "group-brand.csv");
const F2 = path.join(SRC_DIR, "store-brand.csv");
const OUT_PATH = path.join(ROOT, "data/sales/brand-sales.json");

for (const f of [F1, F2]) {
  if (!existsSync(f)) { console.error(`❌ 입력 없음: ${f}`); process.exit(1); }
}

// ── CSV 파서 (따옴표 내 콤마 보존) ──
function parseRow(line) {
  const cols = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === "," && !q) { cols.push(cur); cur = ""; }
    else cur += c;
  }
  cols.push(cur);
  return cols.map((s) => s.trim());
}
function num(s) {
  if (s == null || s.trim() === "") return null;
  const n = parseFloat(s.replace(/,/g, "").replace(/^"|"$/g, ""));
  return Number.isFinite(n) ? n : null;
}
function cleanBrandName(s) {
  if (!s) return s;
  const opens = (s.match(/\(/g) || []).length;
  const closes = (s.match(/\)/g) || []).length;
  return opens > closes ? s + ")" : s;
}
function growth(cur, prev) {
  if (!prev || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// 누적 6개 지표 컬럼(col4~9) → PeriodTotals
function cumulativeTotals(cols) {
  return {
    revenue_current: num(cols[4]),
    revenue_prev: num(cols[5]),
    revenue_growth: num(cols[6]),
    profit_current: num(cols[7]),
    profit_prev: num(cols[8]),
    profit_growth: num(cols[9]),
  };
}

// 월별: 2025-MM은 col[10..39](2025값=struct '[-]2025' 위치), 2026-MM은 col[40..69](2026값=struct '2026')
// 컬럼 인덱스 매핑(검증 완료):
//   2025년 m월(1~5): 총매출 2025값 = col[10 + (m-1)*6 + 1], 이익 2025값 = col[10 + (m-1)*6 + 4]
//   2026년 m월(1~5): 총매출 2026값 = col[40 + (m-1)*6 + 0], 이익 2026값 = col[40 + (m-1)*6 + 3]
function monthlyFromCols(cols) {
  const out = [];
  for (let m = 1; m <= 5; m++) {
    const mm = String(m).padStart(2, "0");
    const base25 = 10 + (m - 1) * 6;
    const base26 = 40 + (m - 1) * 6;
    out.push({
      month: mm,
      revenue_prev: num(cols[base25 + 1]),
      profit_prev: num(cols[base25 + 4]),
      revenue_current: num(cols[base26 + 0]),
      profit_current: num(cols[base26 + 3]),
    });
  }
  return out;
}

async function readCsv(file) {
  const buf = await fs.readFile(file);
  const text = new TextDecoder("euc-kr").decode(buf);
  return text.split(/\r?\n/).map(parseRow);
}

// ── 41개 마스터 로드 ──
async function loadMaster() {
  const t = await fs.readFile(path.join(ROOT, "src/data/homeplus.ts"), "utf8");
  const m = t.match(/export const ELAND_STORES[^=]*=\s*(\[[\s\S]*?\n\]);/);
  const stores = eval(m[1]);
  const norm = (s) => s.replace(/^NC/, "").replace(/점$/, "").replace(/\s+/g, "");
  const nameToStore = new Map(stores.map((s) => [norm(s.name), s]));
  return { stores, norm, nameToStore };
}

async function main() {
  const { norm, nameToStore } = await loadMaster();

  // ─────────────────────────────────────────────
  // File1: 구매그룹 × 브랜드 + 전사 + 월별
  // ─────────────────────────────────────────────
  const rows1 = await readCsv(F1);
  const brands = new Map();      // `${groupCode}|${brandCode}` → brand
  const groupTotals = new Map(); // groupCode → group
  let overallTotal = null;
  let overallMonthly = null;

  for (let i = 7; i < rows1.length; i++) {
    const cols = rows1[i];
    if (cols.length < 10) continue;
    const groupCode = cols[0], groupName = cols[1], brandCode = cols[2], brandName = cols[3];

    if (groupCode === "전체 결과") {
      overallTotal = cumulativeTotals(cols);
      overallMonthly = monthlyFromCols(cols);
      continue;
    }
    // 구매그룹 소계: brandCode === "결과"
    if (groupCode && groupName && brandCode === "결과") {
      groupTotals.set(groupCode, { code: groupCode, name: groupName, ...cumulativeTotals(cols), brandCount: 0 });
      continue;
    }
    // 브랜드 행
    if (groupCode && brandCode && brandName && brandName !== "지정되지 않음" && brandCode !== "#") {
      const key = `${groupCode}|${brandCode}`;
      brands.set(key, {
        groupCode, groupName,
        code: brandCode, name: cleanBrandName(brandName),
        summary: cumulativeTotals(cols),
      });
    }
  }
  for (const b of brands.values()) {
    const g = groupTotals.get(b.groupCode);
    if (g) g.brandCount += 1;
  }

  // ─────────────────────────────────────────────
  // File2: 지점 × 브랜드 (41 마스터만)
  // ─────────────────────────────────────────────
  const rows2 = await readCsv(F2);
  const stores = new Map();   // plant → store record
  let curPlant = null, curStore = null;
  const excludedStores = new Set();

  for (let i = 8; i < rows2.length; i++) {
    const cols = rows2[i];
    if (cols.length < 10) continue;
    const sRaw = cols[0], sName = cols[1], brandCode = cols[2], brandName = cols[3];
    if (sRaw === "전체 결과") continue;

    const plantMatch = sRaw && sRaw.match(/R\d+\/(\d+)/);

    // 지점 소계 행 (브랜드코드 "결과") → 새 지점 시작
    if (plantMatch && brandCode === "결과") {
      const plant = plantMatch[1];
      const master = nameToStore.get(norm(sName));
      if (!master) { excludedStores.add(`${plant} ${sName}`); curStore = null; continue; }
      curPlant = plant;
      curStore = {
        storeId: master.id,
        plant,
        name: master.name,
        brand: master.brand,
        ...cumulativeTotals(cols),
        brands: [],
      };
      stores.set(plant, curStore);
      continue;
    }
    // 지점별 브랜드 행
    if (curStore && brandCode && brandName && brandName !== "지정되지 않음" && brandCode !== "#") {
      const rev = num(cols[4]);
      if (rev && rev > 0) {
        curStore.brands.push({
          code: brandCode,
          name: cleanBrandName(brandName),
          revenue_current: rev,
          revenue_prev: num(cols[5]),
          revenue_growth: num(cols[6]),
          profit_current: num(cols[7]),
        });
      }
    }
  }

  // 지점별 브랜드 매출 내림차순 정렬
  for (const s of stores.values()) {
    s.brands.sort((a, b) => (b.revenue_current ?? 0) - (a.revenue_current ?? 0));
    s.brandCount = s.brands.length;
  }

  // ── 정렬 ──
  const brandList = [...brands.values()]
    .filter((b) => b.summary && b.summary.revenue_current)
    .sort((a, b) => (b.summary.revenue_current ?? 0) - (a.summary.revenue_current ?? 0));
  const groupList = [...groupTotals.values()]
    .sort((a, b) => (b.revenue_current ?? 0) - (a.revenue_current ?? 0));
  const storeList = [...stores.values()]
    .sort((a, b) => (b.revenue_current ?? 0) - (a.revenue_current ?? 0));

  // ── 월별 요약 (전사 기준) ──
  const monthSummary = (overallMonthly ?? []).map((m) => ({
    mm: m.month,
    currentYear: "2026",
    prevYear: "2025",
    revenue_current: m.revenue_current ?? 0,
    revenue_prev: m.revenue_prev ?? 0,
    revenue_growth: growth(m.revenue_current ?? 0, m.revenue_prev ?? 0) ?? 0,
    profit_current: m.profit_current ?? 0,
    profit_prev: m.profit_prev ?? 0,
    profit_growth: growth(m.profit_current ?? 0, m.profit_prev ?? 0) ?? 0,
  }));

  const out = {
    version: "1.0",
    compiledAt: new Date().toISOString().slice(0, 10),
    source: {
      file: SRC_LABEL,
      period1: PERIOD1,
      period2: PERIOD2,
    },
    overallTotal,
    monthSummary,
    groups: groupList,
    stores: storeList,
    brands: brandList,
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");

  // ── 리포트 ──
  const 억 = (n) => (n / 1e8).toFixed(1);
  console.log("✅ data/sales/brand-sales.json 저장");
  console.log(`   전사 매출: ${억(overallTotal?.revenue_current ?? 0)}억 (전년 ${억(overallTotal?.revenue_prev ?? 0)}억, ${overallTotal?.revenue_growth}%)`);
  console.log(`   구매그룹: ${groupList.length}개 / 지점: ${storeList.length}개 / 브랜드: ${brandList.length}개`);
  console.log(`   월별 요약: ${monthSummary.length}개월`);
  if (excludedStores.size) console.log(`   제외 지점(비마스터): ${[...excludedStores].join(", ")}`);
  if (storeList.length !== 41) console.warn(`   ⚠ 지점이 41개가 아닙니다 (${storeList.length}개) — 매칭 확인 필요`);
}

main().catch((e) => { console.error(e); process.exit(1); });
