"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MarketPriceRow } from "@/types/marketPrice";

type UpsertPayload = Omit<MarketPriceRow, "id" | "created_at">;
type Result = { ok: true; row: MarketPriceRow } | { ok: false; error: string };

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

export async function upsertMarketPriceRow(
  id: string | null,
  payload: UpsertPayload,
): Promise<Result> {
  const supabase = await createClient();

  const record = {
    name:                payload.name,
    brand:               payload.brand || null,
    contract_type:       payload.contract_type || null,
    size_range:          payload.size_range || null,
    deposit_median:      payload.deposit_median || null,
    monthly_rent_median: payload.monthly_rent_median || null,
    floor_type:          payload.floor_type || null,
    rent_per_pyeong:     payload.rent_per_pyeong || null,
    store_type:          payload.store_type || null,
    region:              payload.region || null,
    reliability:         payload.reliability || null,
    price_trend:         payload.price_trend || null,
    data_source:         payload.data_source || null,
    sample_count:        payload.sample_count || null,
    note:                payload.note || null,
    last_updated:        payload.last_updated || null,
  };

  let query;
  if (id) {
    query = supabase.from("market_price_data").update(record).eq("id", id).select().single();
  } else {
    query = supabase.from("market_price_data").insert(record).select().single();
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/logs");
  return { ok: true, row: rowToMarket(data as Record<string, unknown>) };
}

export async function deleteMarketPriceRow(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("market_price_data").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/logs");
  return { ok: true };
}
