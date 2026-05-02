#!/usr/bin/env node
/**
 * 매출분석 CSV(EUC-KR) → JSON 변환기
 *
 * 입력 (기본): C:/Users/woo_songki/Desktop/일매출2기간비교분석 (17-09-20).CSV
 *  또는 첫 번째 인자로 경로 지정
 *
 * 출력: data/sales/brand-sales.json
 *
 * 실행:
 *   node scripts/parse-sales-csv.mjs
 *   node scripts/parse-sales-csv.mjs path/to/file.CSV
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT =
  process.argv[2] ?? "C:/Users/woo_songki/Desktop/일매출2기간비교분석 (17-09-20).CSV";
const OUT_PATH = path.join(ROOT, "data/sales/brand-sales.json");

if (!existsSync(DEFAULT_INPUT)) {
  console.error(`❌ 입력 파일 없음: ${DEFAULT_INPUT}`);
  process.exit(1);
}

/** 따옴표 안 콤마를 보존하는 CSV 행 파서 */
function parseRow(line) {
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      cols.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cols.push(cur);
  return cols.map((s) => s.trim());
}

/** 숫자/금액 파싱 (콤마 제거, 빈 문자열은 null) */
function num(s) {
  if (!s || s.trim() === "") return null;
  const cleaned = s.replace(/,/g, "").replace(/^"|"$/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "모던하우스공통(MODERN HOUSE" 같은 잘림 보정 (마지막 ')' 누락 시) */
function cleanBrandName(s) {
  if (!s) return s;
  // 닫는 괄호 누락 보정
  const opens = (s.match(/\(/g) || []).length;
  const closes = (s.match(/\)/g) || []).length;
  if (opens > closes) return s + ")";
  return s;
}

async function main() {
  const buf = await fs.readFile(DEFAULT_INPUT);
  // EUC-KR(=CP949) 디코딩
  const text = new TextDecoder("euc-kr").decode(buf);
  const lines = text.split(/\r?\n/);

  // 메타 추출 (Line 2)
  const metaCols = parseRow(lines[1] ?? "");
  const period1 = metaCols[1] ?? "";
  const period2 = metaCols[3] ?? "";

  // 데이터는 Line 9 (index 8) 부터
  const brands = new Map(); // key=`${groupCode}|${brandCode}` → object
  const groupTotals = new Map(); // key=groupCode → { code, name, revenue_current, revenue_prev, growth, profit_*, brands:Set }
  let overallTotal = null;

  for (let i = 8; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseRow(line);
    if (cols.length < 11) continue;

    const [groupCode, groupName, brandCode, brandName, period,
           rev1Str, rev2Str, growthStr, prof1Str, prof2Str, profGrowthStr] = cols;

    const rev_current = num(rev1Str);
    const rev_prev    = num(rev2Str);
    const growth      = num(growthStr);
    const prof_current = num(prof1Str);
    const prof_prev    = num(prof2Str);
    const prof_growth  = num(profGrowthStr);

    // 1) 전체 결과 (구매그룹 = "전체 결과")
    if (groupCode === "전체 결과") {
      overallTotal = {
        revenue_current: rev_current,
        revenue_prev: rev_prev,
        revenue_growth: growth,
        profit_current: prof_current,
        profit_prev: prof_prev,
        profit_growth: prof_growth,
      };
      continue;
    }

    // 2) 그룹 결과 — col[2]가 "결과", brandName/period 빈 행
    //    예: FAA,모던 특정,결과,,, (col2가 결과 자리에 있음)
    if (groupCode && groupName && brandCode === "결과" && !brandName && !period) {
      groupTotals.set(groupCode, {
        code: groupCode,
        name: groupName,
        revenue_current: rev_current,
        revenue_prev: rev_prev,
        revenue_growth: growth,
        profit_current: prof_current,
        profit_prev: prof_prev,
        profit_growth: prof_growth,
        brandCount: 0,
      });
      continue;
    }

    // 3) 브랜드 행 (brandCode 있음)
    if (groupCode && brandCode && brandName) {
      const key = `${groupCode}|${brandCode}`;
      const cleanedName = cleanBrandName(brandName);

      if (!brands.has(key)) {
        brands.set(key, {
          groupCode,
          groupName,
          code: brandCode,
          name: cleanedName,
          summary: null,
          monthly: [],
        });
      }
      const brand = brands.get(key);

      if (period === "결과") {
        // 브랜드 합계
        brand.summary = {
          revenue_current: rev_current,
          revenue_prev: rev_prev,
          revenue_growth: growth,
          profit_current: prof_current,
          profit_prev: prof_prev,
          profit_growth: prof_growth,
        };
      } else if (/^\d{4}-\d{2}$/.test(period)) {
        brand.monthly.push({
          month: period,
          revenue_current: rev_current,
          revenue_prev: rev_prev,
          profit_current: prof_current,
          profit_prev: prof_prev,
        });
      }
      continue;
    }
  }

  // brandCount 채우기
  for (const b of brands.values()) {
    const g = groupTotals.get(b.groupCode);
    if (g) g.brandCount += 1;
  }

  // 정렬: 매출액 내림차순
  const brandList = [...brands.values()]
    .filter((b) => b.summary !== null)
    .sort((a, b) => (b.summary.revenue_current ?? 0) - (a.summary.revenue_current ?? 0));

  const groupList = [...groupTotals.values()]
    .sort((a, b) => (b.revenue_current ?? 0) - (a.revenue_current ?? 0));

  // 월별 비교 — 각 월의 구매그룹/브랜드 합계
  // monthly 배열에서 2025-MM은 prev, 2026-MM은 current
  // 같은 MM(01~04)끼리 비교 가능하게 묶음
  const monthSummary = aggregateMonthly(brandList);

  const out = {
    $schema: "./brand-sales.schema.json",
    version: "0.1.0",
    compiledAt: new Date().toISOString().slice(0, 10),
    source: {
      file: path.basename(DEFAULT_INPUT),
      period1,
      period2,
    },
    overallTotal,
    monthSummary,
    groups: groupList,
    brands: brandList,
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");

  console.log(`✓ 변환 완료`);
  console.log(`  - 전체 매출(현): ${overallTotal?.revenue_current?.toLocaleString() ?? "?"}원`);
  console.log(`  - 그룹: ${groupList.length}개`);
  console.log(`  - 브랜드: ${brandList.length}개`);
  console.log(`  - 월별 요약: ${monthSummary.length}개`);
  console.log(`  - 출력: ${path.relative(ROOT, OUT_PATH)}`);
}

/**
 * 월별 합계 — 같은 월(MM)끼리 작년/올해 묶기.
 * 2025-MM (prev) 와 2026-MM (current) 행을 쌍으로.
 */
function aggregateMonthly(brands) {
  const monthMap = new Map(); // "MM" → { current, prev }
  for (const b of brands) {
    for (const m of b.monthly) {
      const [year, mm] = m.month.split("-");
      if (!monthMap.has(mm)) {
        monthMap.set(mm, { mm, currentYear: null, prevYear: null, current: 0, prev: 0, profitCurrent: 0, profitPrev: 0 });
      }
      const slot = monthMap.get(mm);
      if (m.revenue_current !== null) {
        slot.current += m.revenue_current;
        slot.currentYear = year;
      }
      if (m.revenue_prev !== null) {
        slot.prev += m.revenue_prev;
        slot.prevYear = year;
      }
      if (m.profit_current !== null) slot.profitCurrent += m.profit_current;
      if (m.profit_prev !== null) slot.profitPrev += m.profit_prev;
    }
  }
  return [...monthMap.values()]
    .sort((a, b) => a.mm.localeCompare(b.mm))
    .map((s) => ({
      mm: s.mm,
      currentYear: s.currentYear,
      prevYear: s.prevYear,
      revenue_current: s.current,
      revenue_prev: s.prev,
      revenue_growth: s.prev > 0 ? Math.round(((s.current - s.prev) / s.prev) * 1000) / 10 : 0,
      profit_current: s.profitCurrent,
      profit_prev: s.profitPrev,
      profit_growth: s.profitPrev > 0 ? Math.round(((s.profitCurrent - s.profitPrev) / s.profitPrev) * 1000) / 10 : 0,
    }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
