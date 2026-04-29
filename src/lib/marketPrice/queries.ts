import { createClient } from "@/lib/supabase/server";
import type { MarketPriceRow } from "@/types/marketPrice";

function rowToMarket(r: Record<string, unknown>): MarketPriceRow {
  return {
    id:                  r.id as string,
    name:                r.name as string,
    brand:               r.brand as string | null,
    contract_type:       r.contract_type as string | null,
    size_range:          r.size_range as string | null,
    deposit_median:      r.deposit_median as string | null,
    monthly_rent_median: r.monthly_rent_median as string | null,
    floor_type:          r.floor_type as string | null,
    rent_per_pyeong:     r.rent_per_pyeong as string | null,
    store_type:          r.store_type as string | null,
    region:              r.region as string | null,
    reliability:         r.reliability as string | null,
    price_trend:         r.price_trend as string | null,
    data_source:         r.data_source as string | null,
    sample_count:        r.sample_count as string | null,
    note:                r.note as string | null,
    last_updated:        r.last_updated as string | null,
    created_at:          r.created_at as string,
  };
}

export async function getMarketPriceData(): Promise<MarketPriceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_price_data")
    .select("*")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map(rowToMarket);
}
