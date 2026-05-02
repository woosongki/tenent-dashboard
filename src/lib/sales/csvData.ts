/**
 * 일매출 2기간 비교분석 CSV → JSON 로더.
 *
 * ⚠ 이 모듈은 217 브랜드 × 9 row 짜리 JSON(~324KB)을 import 합니다.
 * Server Component 에서만 사용하세요. Client Component 는 src/lib/sales/format.ts
 * (순수 유틸/토큰)을 import 하세요.
 *
 * 데이터 출처: scripts/parse-sales-csv.mjs (EUC-KR 원본 CSV)
 * 갱신: 새 CSV 받을 때마다 위 스크립트 재실행.
 */

import "server-only";
import salesData from "../../../data/sales/brand-sales.json";

export interface PeriodTotals {
  revenue_current: number | null;
  revenue_prev: number | null;
  revenue_growth: number | null;
  profit_current: number | null;
  profit_prev: number | null;
  profit_growth: number | null;
}

export interface BrandRecord {
  groupCode: string;
  groupName: string;
  code: string;
  name: string;
  summary: PeriodTotals;
  monthly: {
    month: string;
    revenue_current: number | null;
    revenue_prev: number | null;
    profit_current: number | null;
    profit_prev: number | null;
  }[];
}

export interface GroupRecord extends PeriodTotals {
  code: string;
  name: string;
  brandCount: number;
}

export interface MonthSummary {
  mm: string;
  currentYear: string | null;
  prevYear: string | null;
  revenue_current: number;
  revenue_prev: number;
  revenue_growth: number;
  profit_current: number;
  profit_prev: number;
  profit_growth: number;
}

interface SalesFile {
  version: string;
  compiledAt: string;
  source: { file: string; period1: string; period2: string };
  overallTotal: PeriodTotals | null;
  monthSummary: MonthSummary[];
  groups: GroupRecord[];
  brands: BrandRecord[];
}

const file = salesData as unknown as SalesFile;

export function getSalesMeta() {
  return {
    version: file.version,
    compiledAt: file.compiledAt,
    period1: file.source.period1,
    period2: file.source.period2,
  };
}

export function getOverallTotal(): PeriodTotals | null {
  return file.overallTotal;
}

export function getMonthSummary(): MonthSummary[] {
  return file.monthSummary;
}

export function getGroups(): GroupRecord[] {
  return file.groups;
}

export function getBrands(): BrandRecord[] {
  return file.brands;
}

/** 매출액(현재) 상위 N개 — null 제외 */
export function getTopByRevenue(limit = 5): BrandRecord[] {
  return file.brands
    .filter((b) => (b.summary.revenue_current ?? 0) > 0)
    .sort((a, b) => (b.summary.revenue_current ?? 0) - (a.summary.revenue_current ?? 0))
    .slice(0, limit);
}

/** 매출 성장률 상위 N개 — 작년/올해 모두 데이터 있고 prev>0 (신규/폐점 제외) */
export function getTopByGrowth(limit = 5): BrandRecord[] {
  return file.brands
    .filter((b) => {
      const s = b.summary;
      return (
        s.revenue_current !== null &&
        s.revenue_prev !== null &&
        s.revenue_prev > 0 &&
        s.revenue_growth !== null &&
        Number.isFinite(s.revenue_growth)
      );
    })
    .sort((a, b) => (b.summary.revenue_growth ?? 0) - (a.summary.revenue_growth ?? 0))
    .slice(0, limit);
}

// 색상 토큰/포매터/이름 잘림 보정 등 순수 유틸은 src/lib/sales/format.ts 로 분리됨.
// Client Component 는 그쪽을 import 해야 217 브랜드 JSON 이 클라이언트 번들에 안 실립니다.
