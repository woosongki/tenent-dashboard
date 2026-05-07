import { createClient } from "@/lib/supabase/server";
import type { DashboardSummary, OrgRow, CategoryGroup, CategoryStat } from "@/types/dashboard";
import { getPopupContactCount } from "@/lib/popupContacts";
import {
  getGroups as getSalesGroups,
  getTopByGrowthAmount,
  getTopByGrowth,
} from "@/lib/sales/csvData";
import { getAttractionStats } from "@/lib/attraction/queries";
import { getVacancyResolvedCount, getVacancyRows } from "@/lib/vacancy";

/** 대시보드 Summary 지표 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();

  const [
    orgsRes, membersRes, subsRes, invitationsRes,
    mrrRes, prevMrrRes,
    // 사이드바 "컨텐츠 풀" 3개 탭 — 라이프스타일·F&B·팝업
    // 팝업은 정적 CSV(팝업 컨텍판) 기준이라 supabase 호출 불필요
    lifestyleRes, vendorFnbRes,
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

    // ── 컨텐츠 풀 카운트 ─────────────────────────
    // 라이프스타일 — vendor_lease 테이블 (노션 업체리스트(일반임대) 싱크)
    supabase.from("vendor_lease").select("id", { count: "exact", head: true }),
    // F&B — vendor_fnb 테이블 (컨텐츠 풀 F&B 탭이 실제 표시하는 데이터)
    supabase.from("vendor_fnb").select("id", { count: "exact", head: true }),
  ]);

  // ── 매출 데이터 (CSV 변환본) ─────────────────────────
  const salesGroups = getSalesGroups();
  const topByGrowthAmount = getTopByGrowthAmount(5);
  const topByGrowth = getTopByGrowth(5);

  // ── 입점계획 통계 (attraction_status — 사이드바 "입점계획(26년)"과 동일 소스) ──
  const attraction = await getAttractionStats();

  // ── 공실해결 통계 (정적 CSV — 사이드바 "공실해결"과 동일 소스) ──
  const vacancyResolved = getVacancyResolvedCount();
  const vacancyTotal = getVacancyRows().length;

  const mrr = (mrrRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const prevMrr = (prevMrrRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const mrrChange = prevMrr === 0 ? 0 : Math.round(((mrr - prevMrr) / prevMrr) * 100);

  // 카테고리(=구매그룹) 집계 — CSV 그룹 데이터 그대로 도넛에
  const categoryStats: CategoryStat[] = salesGroups.map((g) => ({
    category: g.name,
    count: g.brandCount,
    revenue: g.revenue_current ?? 0,
  }));

  const contentPoolBreakdown = {
    lifestyle: lifestyleRes.count ?? 0,
    fnb:       vendorFnbRes.count ?? 0,
    // 팝업은 노션 컨텍판(정적 CSV import) 기준
    popup:     getPopupContactCount(),
  };
  const contentPoolCount =
    contentPoolBreakdown.lifestyle + contentPoolBreakdown.fnb + contentPoolBreakdown.popup;

  return {
    totalOrgs: orgsRes.count ?? 0,
    totalMembers: membersRes.count ?? 0,
    activeSubscriptions: subsRes.count ?? 0,
    pendingInvitations: invitationsRes.count ?? 0,
    mrr,
    mrrChange,
    topByGrowthAmount,
    topByGrowth,
    contentPoolCount,
    contentPoolBreakdown,
    attraction: {
      total: attraction.total,
      completed: attraction.completed,
      inProgress: attraction.inProgress,
    },
    vacancy: {
      resolved: vacancyResolved,
      total: vacancyTotal,
    },
    categoryStats,
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
