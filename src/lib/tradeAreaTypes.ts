/**
 * 상권 분석 — 클라이언트와 서버 양쪽에서 안전하게 import 가능한 타입/상수.
 *
 * tradeArea.ts 본체는 node:fs 를 쓰므로 client 컴포넌트에 들어가면 빌드가
 * 실패한다 ("the chunking context does not support external modules").
 * 이 파일은 fs 의존성이 없는 순수 타입·정적 토큰만 모아두기 위한 것.
 */

export interface TradeAreaIndexItem {
  id: string;
  brand: string;
  name: string;
  lawdCd: string;
  region: string;
  radius: number;
  total: number;
  tradeAreaType: string;
  foodPct: number;
  retailPct: number;
  competitorCount: number;
}

export interface TradeAreaBreakdown {
  food: { count: number; pct: number };
  retail: { count: number; pct: number };
  lifeService: { count: number; pct: number };
  medical: { count: number; pct: number };
  education: { count: number; pct: number };
  leisure: { count: number; pct: number };
}

export interface TradeAreaDetail {
  storeId: string;
  storeName: string;
  center: { lat: number; lng: number; address: string };
  radius: number;
  fetchedAt: string;
  tradeAreaType: string;
  total: number;
  breakdown: TradeAreaBreakdown;
  competitorCount: number;
  topL: [string, number][];
  topM: [string, number][];
  topS: [string, number][];
}

export interface CohortStat {
  cohortSize: number;
  avgTotal: number;
  avgFoodPct: number;
  avgRetailPct: number;
  avgCompetitor: number;
  totalPercentile: number;
  peers: { id: string; brand: string; name: string; total: number; competitorCount: number }[];
}

/** 상권 라벨링용 색상 매핑 (Slate 팔레트) */
export const TRADE_AREA_BADGE: Record<string, string> = {
  "음식 중심 상권":   "bg-orange-50 text-orange-700 border-orange-200",
  "소매 중심 상권":   "bg-blue-50 text-blue-700 border-blue-200",
  "학세권/교육 상권": "bg-violet-50 text-violet-700 border-violet-200",
  "의료 인접 상권":   "bg-pink-50 text-pink-700 border-pink-200",
  "관광/여가 상권":   "bg-teal-50 text-teal-700 border-teal-200",
  "복합 상권":        "bg-slate-50 text-slate-700 border-slate-200",
  "저밀도 상권":      "bg-zinc-50 text-zinc-600 border-zinc-200",
};
