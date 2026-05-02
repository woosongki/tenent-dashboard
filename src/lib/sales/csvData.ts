/**
 * 일매출 2기간 비교분석 CSV → JSON 로더.
 *
 * 데이터 출처: scripts/parse-sales-csv.mjs (EUC-KR 원본 CSV)
 * 갱신: 새 CSV 받을 때마다 위 스크립트 재실행.
 */

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

/** Slate 디자인 시스템에 맞춘 그룹 색상 (도넛/카드 공용) */
export const GROUP_COLOR: Record<string, { hex: string; bg: string; text: string }> = {
  "FAA": { hex: "#8b5cf6", bg: "bg-violet-50",  text: "text-violet-700"  }, // 모던 특정
  "EBA": { hex: "#f59e0b", bg: "bg-amber-50",   text: "text-amber-700"   }, // 취미/라이프
  "EFA": { hex: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" }, // 가정문화
  "EGA": { hex: "#0ea5e9", bg: "bg-sky-50",     text: "text-sky-700"     }, // 테넌트일반
};

/** 잘림 보정: "(MODERN HOUSE" 같은 미완 → 짧은 라벨 */
export function shortBrandName(name: string, maxLen = 16): string {
  // 괄호 영문 제거 (UX용)
  const cleaned = name.replace(/\([^)]*\)?$/g, "").trim();
  if (cleaned.length === 0) return name;
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + "…";
}

const KRW_FORMAT = new Intl.NumberFormat("ko-KR");

/** "₩30,674,265,569" → "306억" / "30억 6천만" 등 컴팩트 표현 */
export function formatKRWCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1_0000_0000) {
    // 1억 이상
    const eok = Math.floor(abs / 1_0000_0000);
    const cheonman = Math.floor((abs % 1_0000_0000) / 10_000_000);
    const sign = amount < 0 ? "-" : "";
    return cheonman > 0 ? `${sign}${eok}억 ${cheonman}천만` : `${sign}${eok}억`;
  }
  if (abs >= 10_000) {
    return `${KRW_FORMAT.format(Math.round(amount / 10_000))}만`;
  }
  return KRW_FORMAT.format(amount);
}

export function formatKRW(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `₩${KRW_FORMAT.format(amount)}`;
}
