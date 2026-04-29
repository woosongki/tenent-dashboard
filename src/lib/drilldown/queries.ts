import { createClient } from "@/lib/supabase/server";
import type {
  Channel, Brand, ChannelSummary, BrandChannelSummary, BrandDailyStat, DailyStat, DateRange,
} from "@/types/drilldown";

// ── 기본 날짜 범위 (최근 30일) ───────────────────────────────
export function defaultDateRange(): DateRange {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

// ── 채널 목록 ────────────────────────────────────────────────
export async function getChannels(orgId: string): Promise<Channel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((r) => ({
    id:             r.id,
    organizationId: r.organization_id,
    name:           r.name,
    type:           r.type,
    color:          r.color,
    isActive:       r.is_active,
    createdAt:      r.created_at,
  }));
}

// ── 브랜드 목록 ──────────────────────────────────────────────
export async function getBrands(orgId: string): Promise<Brand[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  return (data ?? []).map((r) => ({
    id:             r.id,
    organizationId: r.organization_id,
    name:           r.name,
    description:    r.description,
    color:          r.color,
    logoUrl:        r.logo_url,
    isActive:       r.is_active,
    createdAt:      r.created_at,
  }));
}

// ── 채널별 집계 + Sparkline ───────────────────────────────────
export async function getChannelSummaries(
  orgId: string,
  range: DateRange,
): Promise<ChannelSummary[]> {
  const supabase = await createClient();

  // 집계
  const { data: summary } = await supabase
    .from("channel_summary")
    .select("*")
    .eq("organization_id", orgId);

  if (!summary?.length) return [];

  // Sparkline용 일별 sessions (날짜 범위 필터)
  const { data: daily } = await supabase
    .from("channel_stats")
    .select("channel_id, stat_date, sessions")
    .eq("organization_id", orgId)
    .gte("stat_date", range.from)
    .lte("stat_date", range.to)
    .order("stat_date");

  // 채널별 일별 합산 → sparkline 배열
  const sparkMap = new Map<string, Map<string, number>>();
  for (const row of daily ?? []) {
    if (!sparkMap.has(row.channel_id)) sparkMap.set(row.channel_id, new Map());
    const dayMap = sparkMap.get(row.channel_id)!;
    dayMap.set(row.stat_date, (dayMap.get(row.stat_date) ?? 0) + row.sessions);
  }

  return summary.map((r) => {
    const dayMap   = sparkMap.get(r.channel_id) ?? new Map<string, number>();
    const sparkline = buildSparkline(dayMap, range);
    return {
      channelId:        r.channel_id,
      channelName:      r.channel_name,
      channelType:      r.channel_type,
      color:            r.color,
      totalSessions:    Number(r.total_sessions ?? 0),
      totalConversions: Number(r.total_conversions ?? 0),
      totalRevenue:     Number(r.total_revenue ?? 0),
      totalAdSpend:     Number(r.total_ad_spend ?? 0),
      conversionRate:   Number(r.conversion_rate ?? 0),
      roas:             r.roas !== null ? Number(r.roas) : null,
      cpa:              r.cpa  !== null ? Number(r.cpa)  : null,
      sparkline,
    };
  });
}

// ── 채널 단건 조회 ────────────────────────────────────────────
export async function getChannel(channelId: string): Promise<Channel | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("*")
    .eq("id", channelId)
    .single();

  if (!data) return null;
  return {
    id:             data.id,
    organizationId: data.organization_id,
    name:           data.name,
    type:           data.type,
    color:          data.color,
    isActive:       data.is_active,
    createdAt:      data.created_at,
  };
}

// ── 채널 내 브랜드별 집계 ────────────────────────────────────
export async function getBrandSummariesByChannel(
  orgId: string,
  channelId: string,
  range: DateRange,
): Promise<BrandChannelSummary[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("channel_stats")
    .select(`
      brand_id,
      brands!inner(name, color),
      sessions, conversions, revenue, ad_spend
    `)
    .eq("organization_id", orgId)
    .eq("channel_id", channelId)
    .gte("stat_date", range.from)
    .lte("stat_date", range.to);

  if (!data?.length) return [];

  // 브랜드별 집계
  const brandMap = new Map<string, {
    name: string; color: string;
    sessions: number; conversions: number; revenue: number; adSpend: number;
  }>();

  for (const row of data) {
    const brand = row.brands as unknown as { name: string; color: string };
    if (!brandMap.has(row.brand_id)) {
      brandMap.set(row.brand_id, { name: brand.name, color: brand.color, sessions: 0, conversions: 0, revenue: 0, adSpend: 0 });
    }
    const b = brandMap.get(row.brand_id)!;
    b.sessions    += row.sessions;
    b.conversions += row.conversions;
    b.revenue     += Number(row.revenue);
    b.adSpend     += Number(row.ad_spend);
  }

  return [...brandMap.entries()].map(([brandId, b]) => ({
    brandId,
    brandName:        b.name,
    brandColor:       b.color,
    totalSessions:    b.sessions,
    totalConversions: b.conversions,
    totalRevenue:     b.revenue,
    totalAdSpend:     b.adSpend,
    conversionRate:   b.sessions > 0 ? Math.round((b.conversions / b.sessions) * 10000) / 100 : 0,
    roas:             b.adSpend > 0 ? Math.round((b.revenue / b.adSpend) * 100) / 100 : null,
    cpa:              b.conversions > 0 ? Math.round((b.adSpend / b.conversions) * 100) / 100 : null,
  }));
}

// ── 브랜드 단건 조회 ──────────────────────────────────────────
export async function getBrand(brandId: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (!data) return null;
  return {
    id:             data.id,
    organizationId: data.organization_id,
    name:           data.name,
    description:    data.description,
    color:          data.color,
    logoUrl:        data.logo_url,
    isActive:       data.is_active,
    createdAt:      data.created_at,
  };
}

// ── 브랜드 × 채널 일별 시계열 ────────────────────────────────
export async function getDailyStats(
  channelId: string,
  brandId: string,
  range: DateRange,
): Promise<DailyStat[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("channel_stats")
    .select("stat_date, sessions, conversions, revenue, ad_spend")
    .eq("channel_id", channelId)
    .eq("brand_id", brandId)
    .gte("stat_date", range.from)
    .lte("stat_date", range.to)
    .order("stat_date");

  return (data ?? []).map((r) => {
    const sessions    = r.sessions;
    const conversions = r.conversions;
    const revenue     = Number(r.revenue);
    const adSpend     = Number(r.ad_spend);
    return {
      statDate:       r.stat_date,
      sessions,
      conversions,
      revenue,
      adSpend,
      conversionRate: sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0,
      roas:           adSpend > 0 ? Math.round((revenue / adSpend) * 100) / 100 : null,
      cpa:            conversions > 0 ? Math.round((adSpend / conversions) * 100) / 100 : null,
    };
  });
}

// ── 채널 내 브랜드별 일별 데이터 (누적 바 차트용) ──────────────
export async function getBrandDailyStats(
  orgId: string,
  channelId: string,
  range: DateRange,
): Promise<BrandDailyStat[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("channel_stats")
    .select(`
      stat_date, sessions, revenue, ad_spend, brand_id,
      brands!inner(name, color)
    `)
    .eq("organization_id", orgId)
    .eq("channel_id", channelId)
    .gte("stat_date", range.from)
    .lte("stat_date", range.to)
    .order("stat_date");

  return (data ?? []).map((r) => {
    const brand = r.brands as unknown as { name: string; color: string };
    return {
      statDate:   r.stat_date,
      brandId:    r.brand_id,
      brandName:  brand.name,
      brandColor: brand.color,
      sessions:   r.sessions,
      revenue:    Number(r.revenue),
      adSpend:    Number(r.ad_spend),
    };
  });
}

// ── 내부 유틸 ────────────────────────────────────────────────

function buildSparkline(dayMap: Map<string, number>, range: DateRange): number[] {
  const result: number[] = [];
  const start = new Date(range.from);
  const end   = new Date(range.to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push(dayMap.get(key) ?? 0);
  }
  return result;
}
