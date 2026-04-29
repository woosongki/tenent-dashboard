import { createClient } from "@/lib/supabase/server";
import type { DashboardSummary, OrgRow, CategoryGroup, TopBrand } from "@/types/dashboard";

/** 대시보드 Summary 지표 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();

  const [
    orgsRes, membersRes, subsRes, invitationsRes,
    mrrRes, prevMrrRes,
    topBrandsRes, contentCountRes, positiveRes,
  ] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("organization_members").select("user_id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing"]),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("billing_history").select("amount").eq("status", "paid")
      .gte("paid_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("billing_history").select("amount").eq("status", "paid")
      .gte("paid_at", new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString())
      .lt("paid_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

    // 매출 성장률 상위 브랜드 (최대 10개)
    supabase.from("brand_performance")
      .select("brand_name, category, revenue_current, revenue_prev, revenue_growth")
      .eq("row_type", "brand")
      .not("revenue_growth", "is", null)
      .order("revenue_growth", { ascending: false })
      .limit(10),

    // 브랜드 총 수
    supabase.from("brand_performance").select("id", { count: "exact", head: true }).eq("row_type", "brand"),

    // 성장 플러스 브랜드 수
    supabase.from("brand_performance").select("id", { count: "exact", head: true })
      .eq("row_type", "brand")
      .gt("revenue_growth", 0),
  ]);

  const mrr = (mrrRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const prevMrr = (prevMrrRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const mrrChange = prevMrr === 0 ? 0 : Math.round(((mrr - prevMrr) / prevMrr) * 100);

  const topBrands: TopBrand[] = (topBrandsRes.data ?? []).map((r, i) => ({
    rank: i + 1,
    brand_name: r.brand_name,
    category: r.category,
    revenue_current: r.revenue_current !== null ? Number(r.revenue_current) : null,
    revenue_prev: r.revenue_prev !== null ? Number(r.revenue_prev) : null,
    revenue_growth: Number(r.revenue_growth),
  }));

  return {
    totalOrgs: orgsRes.count ?? 0,
    totalMembers: membersRes.count ?? 0,
    activeSubscriptions: subsRes.count ?? 0,
    pendingInvitations: invitationsRes.count ?? 0,
    mrr,
    mrrChange,
    topBrands,
    contentCount: contentCountRes.count ?? 0,
    positiveGrowthCount: positiveRes.count ?? 0,
  };
}

/** 플랜별로 그룹핑된 조직 목록 */
export async function getOrgsByCategory(): Promise<CategoryGroup[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("active_subscriptions")
    .select(`organization_id, organization_name, organization_slug, plan_name, plan_display_name, max_seats, status, billing_interval, current_price`)
    .order("plan_name");

  if (error || !data) return [];

  const orgIds = data.map((r) => r.organization_id);
  const { data: memberCounts } = await supabase
    .from("organization_members").select("organization_id").in("organization_id", orgIds);

  const countMap = (memberCounts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.organization_id] = (acc[row.organization_id] ?? 0) + 1;
    return acc;
  }, {});

  const { data: orgDates } = await supabase.from("organizations").select("id, created_at").in("id", orgIds);
  const dateMap = (orgDates ?? []).reduce<Record<string, string>>((acc, row) => {
    acc[row.id] = row.created_at;
    return acc;
  }, {});

  const orgRows: OrgRow[] = data.map((r) => ({
    id: r.organization_id,
    name: r.organization_name,
    slug: r.organization_slug,
    planName: r.plan_name,
    planDisplayName: r.plan_display_name,
    memberCount: countMap[r.organization_id] ?? 0,
    maxSeats: r.max_seats,
    subscriptionStatus: r.status,
    billingInterval: r.billing_interval,
    currentPrice: Number(r.current_price),
    createdAt: dateMap[r.organization_id] ?? "",
  }));

  const groupMap = new Map<string, CategoryGroup>();
  for (const org of orgRows) {
    if (!groupMap.has(org.planName)) {
      groupMap.set(org.planName, { planName: org.planName, planDisplayName: org.planDisplayName, orgs: [], totalMembers: 0, totalRevenue: 0 });
    }
    const group = groupMap.get(org.planName)!;
    group.orgs.push(org);
    group.totalMembers += org.memberCount;
    group.totalRevenue += org.currentPrice;
  }

  const order = ["free", "pro", "enterprise"];
  return [...groupMap.values()].sort((a, b) => order.indexOf(a.planName) - order.indexOf(b.planName));
}
