/**
 * 점포 인근(동일 행정동 우선) 매매 실거래가 → 추정 임대료 환산.
 *
 * 정부 공개 API에는 상가 임대(rent) 데이터가 없어 매매가를 자본환원율로 환산해 사용.
 * 보고용 추정값임을 캡션에서 명시.
 */

import type { TradeItem } from "@/lib/realEstate";

/** 평균 자본환원율 — 서울/수도권 상가 평균치 (5.5%, 보수적 가정) */
const CAP_RATE = 0.055;

/** 1평 = 3.3058 ㎡ */
export const PYEONG_TO_M2 = 3.3058;

export interface LocalRentStats {
  /** 사용된 매칭 단위 ("행정동" | "시군구" | "없음") */
  scope: "동" | "시군구" | "없음";
  /** 매칭 단위 표시 라벨 */
  scopeLabel: string;
  /** 표본 수 (매칭 거래 건수) */
  sampleCount: number;
  /** 평균 ㎡당 매매가 (만원) */
  avgPricePerM2_10k: number;
  /** 중위 ㎡당 매매가 (만원) */
  medianPricePerM2_10k: number;
  /** 매매 시세 중위 (전체 거래가 만원) */
  medianTotalPrice_10k: number;
  /** ㎡당 추정 월임대료 (원) — 매매가 × CAP_RATE / 12 */
  estimatedMonthlyRentPerM2: number;
  /** 평형별 추정 월임대료 (원) — 10/20/33평 */
  estimatedMonthlyRentByPyeong: { pyeong: number; monthlyRent: number; areaM2: number }[];
  /** 사용된 데이터 신선도 */
  fetchedAt: string;
}

interface ComputeArgs {
  /** fetchCommercialTrade 응답 */
  trades: TradeItem[];
  /** 점포 행정동 (region3) — "역삼동", "강남동" 등 */
  storeRegion3: string | null;
  /** 점포 시군구 (region2) — 동 매칭 실패 시 fallback */
  storeRegion2: string | null;
}

/** 거래 1건의 ㎡당 가격 (만원) */
function pricePerM2(trade: TradeItem): number | null {
  if (!trade.area_m2 || trade.area_m2 <= 0) return null;
  if (!trade.price_10k || trade.price_10k <= 0) return null;
  return trade.price_10k / trade.area_m2;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/**
 * 점포 region3와 매칭되는 거래만 추려 평균/중위 ㎡당 매매가를 계산하고,
 * 자본환원율(5.5%)로 ㎡당 월 임대료를 환산.
 *
 * 매칭 우선순위:
 *  1) trade.district 가 점포의 region3 와 동일 → "동" scope
 *  2) trade.district 가 점포의 region2(시군구) 와 매칭 → "시군구" scope
 *  3) 전체 거래 평균 → "시군구" 라벨로 표시 (fallback)
 */
export function computeLocalRent({ trades, storeRegion3, storeRegion2 }: ComputeArgs): LocalRentStats {
  const nowIso = new Date().toISOString();

  if (trades.length === 0) {
    return {
      scope: "없음",
      scopeLabel: "거래 데이터 없음",
      sampleCount: 0,
      avgPricePerM2_10k: 0,
      medianPricePerM2_10k: 0,
      medianTotalPrice_10k: 0,
      estimatedMonthlyRentPerM2: 0,
      estimatedMonthlyRentByPyeong: [],
      fetchedAt: nowIso,
    };
  }

  // 1차: 동일 행정동 매칭
  let matched: TradeItem[] = [];
  let scope: LocalRentStats["scope"] = "동";
  let scopeLabel = "";

  if (storeRegion3) {
    matched = trades.filter((t) => t.district === storeRegion3);
    scopeLabel = storeRegion3;
  }

  // 2차 fallback: 동 매칭 표본 부족 → 전체 (시군구 단위)
  if (matched.length < 3) {
    matched = trades;
    scope = "시군구";
    scopeLabel = storeRegion2 ?? "권역 전체";
  }

  // ㎡당 가격 (만원)
  const perM2List = matched.map(pricePerM2).filter((p): p is number => p !== null && p > 0);
  const totalPrices = matched.map((t) => t.price_10k).filter((p) => p > 0);

  if (perM2List.length === 0) {
    return {
      scope: "없음",
      scopeLabel: "유효 거래 없음",
      sampleCount: 0,
      avgPricePerM2_10k: 0,
      medianPricePerM2_10k: 0,
      medianTotalPrice_10k: 0,
      estimatedMonthlyRentPerM2: 0,
      estimatedMonthlyRentByPyeong: [],
      fetchedAt: nowIso,
    };
  }

  const avgPerM2 = avg(perM2List);
  const medPerM2 = median(perM2List);
  const medTotal = median(totalPrices);

  // 추정 월 임대료 (원/㎡) = 매매가(만원/㎡) × 10000 × CAP_RATE / 12
  // 보수적으로 중위값 사용
  const estMonthlyRentPerM2 = (medPerM2 * 10000 * CAP_RATE) / 12;

  // 평형별 (10/20/33평)
  const pyeongs = [10, 20, 33];
  const byPyeong = pyeongs.map((p) => {
    const areaM2 = p * PYEONG_TO_M2;
    return {
      pyeong: p,
      areaM2,
      monthlyRent: Math.round(estMonthlyRentPerM2 * areaM2),
    };
  });

  return {
    scope,
    scopeLabel,
    sampleCount: matched.length,
    avgPricePerM2_10k: avgPerM2,
    medianPricePerM2_10k: medPerM2,
    medianTotalPrice_10k: medTotal,
    estimatedMonthlyRentPerM2: Math.round(estMonthlyRentPerM2),
    estimatedMonthlyRentByPyeong: byPyeong,
    fetchedAt: nowIso,
  };
}

/** 원 단위 포맷 — "1,234만원" 또는 "1.2억원" */
export function formatRent(won: number): string {
  if (!won || won <= 0) return "-";
  if (won >= 100_000_000) {
    const eok = won / 100_000_000;
    return `${eok.toFixed(eok >= 10 ? 0 : 1)}억원`;
  }
  if (won >= 10000) {
    return `${Math.round(won / 10000).toLocaleString()}만원`;
  }
  return `${won.toLocaleString()}원`;
}

/** ㎡당 매매가 (만원) → "X,XXX만/㎡" */
export function formatPricePerM2(price_10k: number): string {
  if (!price_10k || price_10k <= 0) return "-";
  return `${Math.round(price_10k).toLocaleString()}만/㎡`;
}

/** 자본환원율 노출용 (UI 캡션) */
export const CAP_RATE_PERCENT = (CAP_RATE * 100).toFixed(1);
