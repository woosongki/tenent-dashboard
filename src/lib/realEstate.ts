/**
 * k-skill-proxy 를 통한 한국 부동산 실거래가 fetch.
 * 사용자 별도 API 키 불필요 (proxy 측에서 DATA_GO_KR_API_KEY 주입).
 *
 * 정부 공개 API는 상가 임대(rent)는 제공하지 않고 매매(trade)만 제공합니다.
 * 임대 시세는 한국부동산원 분기별 권역 평균치 또는 민간 데이터(별도 통합)로 보완.
 */

const PROXY_BASE =
  process.env.KSKILL_PROXY_BASE_URL ?? "https://k-skill-proxy.nomadamas.org";

export interface TradeItem {
  name: string;
  district: string;
  area_m2: number;
  floor: number;
  price_10k: number;
  deal_date: string;
  build_year: number;
  deal_type?: string;
}

export interface TradeSummary {
  median_price_10k: number;
  min_price_10k: number;
  max_price_10k: number;
  sample_count: number;
}

export interface TradeResponse {
  items: TradeItem[];
  summary: TradeSummary | null;
  query: { asset_type: string; deal_type: string; lawd_cd: string; deal_ymd: string };
}

/** 최근 N개월 상업용 매매 실거래가 (lawdCd=시군구 5자리) */
export async function fetchCommercialTrade(
  lawdCd: string,
  options: { months?: number; numOfRows?: number } = {},
): Promise<TradeResponse> {
  const months = options.months ?? 3;
  const rows = options.numOfRows ?? 200;

  const now = new Date();
  // 국토부 신고 데이터 lag 고려 → 한 달 전부터
  now.setMonth(now.getMonth() - 1);

  const ymds: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    ymds.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const results = await Promise.all(
    ymds.map(async (deal_ymd) => {
      const url =
        `${PROXY_BASE}/v1/real-estate/commercial/trade?` +
        new URLSearchParams({
          lawd_cd: lawdCd,
          deal_ymd,
          num_of_rows: String(rows),
        });
      try {
        const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return (await res.json()) as TradeResponse;
      } catch {
        return null;
      }
    }),
  );

  const valid = results.filter((r): r is TradeResponse => r !== null);
  const allItems = valid.flatMap((r) => r.items ?? []);

  if (allItems.length === 0) {
    return {
      items: [],
      summary: null,
      query: {
        asset_type: "commercial",
        deal_type: "trade",
        lawd_cd: lawdCd,
        deal_ymd: ymds.join(","),
      },
    };
  }

  const prices = allItems
    .map((i) => i.price_10k)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;

  return {
    items: allItems.sort((a, b) => b.deal_date.localeCompare(a.deal_date)),
    summary: {
      median_price_10k: median,
      min_price_10k: prices[0] ?? 0,
      max_price_10k: prices[prices.length - 1] ?? 0,
      sample_count: allItems.length,
    },
    query: {
      asset_type: "commercial",
      deal_type: "trade",
      lawd_cd: lawdCd,
      deal_ymd: ymds.join(","),
    },
  };
}

export function formatPrice10k(price10k: number): string {
  if (!price10k || price10k <= 0) return "-";
  if (price10k >= 10000) {
    const eok = Math.floor(price10k / 10000);
    const rest = price10k % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만` : `${eok}억`;
  }
  return `${price10k.toLocaleString()}만`;
}
