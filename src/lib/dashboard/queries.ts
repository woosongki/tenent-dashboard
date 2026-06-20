import { createClient } from "@/lib/supabase/server";
import type { OrgRow, CategoryGroup } from "@/types/dashboard";

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
