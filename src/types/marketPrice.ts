export interface MarketPriceRow {
  id: string;
  name: string;             // 지점명
  brand: string | null;     // 브랜드
  contract_type: string | null;       // 계약유형
  size_range: string | null;          // 평수구간
  deposit_median: string | null;      // 보증금_중앙값
  monthly_rent_median: string | null; // 월세_중앙값
  floor_type: string | null;          // 층수
  rent_per_pyeong: string | null;     // 평당월세_역산
  store_type: string | null;          // 상가유형
  region: string | null;              // 지역구분
  reliability: string | null;         // 신뢰도
  price_trend: string | null;         // 지수추세
  data_source: string | null;         // 데이터출처
  sample_count: string | null;        // 표본건수
  note: string | null;                // 비고
  last_updated: string | null;        // 최종갱신일
  created_at: string;
}

export const MARKET_BRANDS = ["뉴코아아울렛", "NC백화점", "2001아울렛", "동아백화점"] as const;
export const MARKET_CONTRACT_TYPES = ["월세", "전세"] as const;
export const MARKET_SIZE_RANGES = ["10평미만", "10~20평", "20~30평", "30~50평", "50평이상"] as const;
export const MARKET_FLOOR_TYPES = ["지하", "1층", "2층", "3층이상", "혼합"] as const;
export const MARKET_STORE_TYPES = ["소규모상가", "집합상가", "중대형상가"] as const;
export const MARKET_REGIONS = ["수도권", "비수도권"] as const;
export const MARKET_RELIABILITIES = ["높음", "중간", "낮음_표본부족"] as const;
export const MARKET_PRICE_TRENDS = ["상승", "보합", "하락"] as const;
export const MARKET_DATA_SOURCES = ["공공API_매매신고", "부동산원_통계지수", "수동_호가조사", "공인중개사문의"] as const;

export const RELIABILITY_META: Record<string, { label: string; cls: string }> = {
  "높음":           { label: "높음",    cls: "bg-emerald-50 text-emerald-700" },
  "중간":           { label: "중간",    cls: "bg-amber-50   text-amber-700"   },
  "낮음_표본부족":   { label: "낮음",    cls: "bg-rose-50    text-rose-700"    },
};

export const TREND_META: Record<string, { label: string; cls: string; icon: string }> = {
  "상승": { label: "상승", cls: "text-emerald-600", icon: "↑" },
  "보합": { label: "보합", cls: "text-slate-500",   icon: "→" },
  "하락": { label: "하락", cls: "text-rose-500",    icon: "↓" },
};
