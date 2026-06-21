import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getLivingPopupSeed } from "@/lib/livingPopupSeed";
import type { LivingPopup, LivingSpace, DailyMap } from "@/lib/livingPopup";

interface Row {
  id: string; year: number; brand: string; store: string;
  start_date: string; end_date: string;
  channel: string | null; popup_type: string | null;
  promo: string | null; vendor: string | null; sales: number | null; note: string | null;
}

function mapRow(r: Row): LivingPopup {
  return {
    id: r.id, year: r.year, brand: r.brand, store: r.store,
    startDate: r.start_date, endDate: r.end_date,
    channel: r.channel, popupType: r.popup_type,
    promo: r.promo, vendor: r.vendor, sales: r.sales, note: r.note,
  };
}

/**
 * 리빙 주제전 데이터 로드. 비어있고 admin이면 26년 시드를 1회 import 후 반환.
 */
export async function getLivingPopups(orgId: string, year = 2026, canSeed = false): Promise<LivingPopup[]> {
  const supabase = await createClient();
  const sel = () => supabase
    .from("living_popup")
    .select("id,year,brand,store,start_date,end_date,channel,popup_type,promo,vendor,sales,note")
    .eq("organization_id", orgId)
    .eq("year", year)
    .order("start_date", { ascending: true });

  let { data } = await sel();
  if ((!data || data.length === 0) && canSeed) {
    const seed = getLivingPopupSeed()
      .filter((s) => s.year === year)
      .map((s) => ({ ...s, organization_id: orgId }));
    if (seed.length) {
      await supabase.from("living_popup").insert(seed);
      ({ data } = await sel());
    }
  }
  return (data ?? []).map((r) => mapRow(r as Row));
}

/** 공간 카탈로그 (지점별 층·장소·평수) */
export async function getLivingSpaces(orgId: string): Promise<LivingSpace[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("living_space")
    .select("id,store,floor,place,area_pyeong,note")
    .eq("organization_id", orgId)
    .order("store", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id, store: r.store, floor: r.floor, place: r.place,
    areaPyeong: r.area_pyeong == null ? null : Number(r.area_pyeong), note: r.note,
  }));
}

/** 팝업별 일매출(원) 맵 */
export async function getLivingDaily(orgId: string): Promise<DailyMap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("living_popup_daily")
    .select("popup_id,date,sales")
    .eq("organization_id", orgId)
    .order("date", { ascending: true });
  const out: DailyMap = {};
  for (const r of data ?? []) (out[r.popup_id] ??= []).push({ date: r.date, sales: Number(r.sales) });
  return out;
}
