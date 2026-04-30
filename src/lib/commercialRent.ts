/**
 * 한국부동산원 상업용 임대료 권역 평균 로더.
 *
 * 데이터 출처: data/rent/commercial-rent.json (수동 큐레이팅, 분기별 갱신)
 * 정확도: 시군구 매핑 → 부재 시 시도 fallback → 전국 평균
 */

import rentData from "../../data/rent/commercial-rent.json";

interface RentMetric {
  rent_per_m2: number;
  vacancy_pct?: number;
  yield_pct?: number;
}

interface RegionRent {
  name: string;
  smallRetail_rent: number;
  note?: string;
}

interface CommercialRentFile {
  version: string;
  compiledAt: string;
  source: {
    publisher: string;
    report: string;
    period: string;
    url: string;
    note: string;
  };
  unit: {
    rent: string;
    vacancy: string;
    yield: string;
  };
  national: {
    smallRetail: RentMetric;
    mediumRetail: RentMetric;
    compositeMall: RentMetric;
    office: RentMetric;
  };
  siDoFallback: Record<string, RegionRent>;
  byLawdCd: Record<string, RegionRent>;
}

const file = rentData as unknown as CommercialRentFile;

export type RentLevel = "lawd" | "siDo" | "national";

export interface RentLookup {
  /** 적용된 데이터 단위 (시군구 → 시도 → 전국 순) */
  level: RentLevel;
  /** 권역 명칭 (예: "서울특별시 강남구" / "서울특별시" / "전국 평균") */
  scope: string;
  /** 소규모 상가 ㎡당 월 임대료 (원) */
  smallRetail_rent: number;
  /** 메타 노트 (있으면 표시) */
  note?: string;
}

/** lawdCd(시군구 5자리)로 권역 평균 임대료 조회 — 3단계 fallback */
export function getCommercialRent(lawdCd: string): RentLookup {
  const direct = file.byLawdCd[lawdCd];
  if (direct) {
    return {
      level: "lawd",
      scope: direct.name,
      smallRetail_rent: direct.smallRetail_rent,
      note: direct.note,
    };
  }

  const siDoCode = lawdCd.slice(0, 2);
  const sido = file.siDoFallback[siDoCode];
  if (sido) {
    return {
      level: "siDo",
      scope: `${sido.name} 평균`,
      smallRetail_rent: sido.smallRetail_rent,
    };
  }

  return {
    level: "national",
    scope: "전국 평균",
    smallRetail_rent: file.national.smallRetail.rent_per_m2,
  };
}

export function getRentSource() {
  return file.source;
}

export function getNationalBenchmarks() {
  return file.national;
}

/** 12,000 → "1만 2,000원" / 1,250,000 → "125만원" */
export function formatWon(amount: number): string {
  if (!amount || amount <= 0) return "-";
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    const rest = amount % 10000;
    return rest > 0 ? `${man}만 ${rest.toLocaleString()}원` : `${man}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

/** 33㎡(10평)·66㎡(20평) 환산 월세 */
export function estimateMonthlyByPyeong(rentPerM2: number, pyeong: number): number {
  return Math.round(rentPerM2 * pyeong * 3.3058);
}
