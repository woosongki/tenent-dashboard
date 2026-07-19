import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { getExpiringContracts } from "@/lib/tenantContracts";
import { getOfflineMeta } from "@/lib/sales/queries";

// 홈 허브 액션 스트립 + 알림 벨용 요약. 여러 도메인의 "지금 봐야 할 것" 카운트를 한 번에.
export interface HomeSummary {
  expiryD14: number;          // 14일 이내 만료 계약
  expiryD30: number;          // 30일 이내 만료 계약
  meetingsActive: number;     // 조직의 업체미팅 수
  pendingApprovals: number | null; // 승인 대기 인원 (owner/admin만, 아니면 null)
  salesBaseYm: string | null; // 매출 데이터 기준월 (YYYY-MM)
}

export async function getHomeSummary(): Promise<HomeSummary> {
  const supabase = await createClient();
  const { user, role } = await getSessionContext();
  const isAdmin = role === "owner" || role === "admin";

  let orgId: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    orgId = (data?.organization_id as string | undefined) ?? null;
  }

  const [expiring, meta, meetingsRes, approvalsRes] = await Promise.all([
    getExpiringContracts({ withinDays: 30 }).catch(() => []),
    getOfflineMeta().catch(() => ({ cumYear: null, monthYm: null })),
    orgId
      ? supabase.from("vendor_meetings").select("id", { count: "exact", head: true }).eq("organization_id", orgId)
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_approved", false)
      : Promise.resolve({ count: null }),
  ]);

  return {
    expiryD14: expiring.filter((c) => c.daysUntilExpiry <= 14).length,
    expiryD30: expiring.length,
    meetingsActive: (meetingsRes as { count: number | null }).count ?? 0,
    pendingApprovals: isAdmin ? ((approvalsRes as { count: number | null }).count ?? 0) : null,
    salesBaseYm: (meta as { monthYm: string | null }).monthYm ?? null,
  };
}
