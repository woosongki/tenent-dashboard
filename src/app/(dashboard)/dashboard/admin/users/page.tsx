import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE, TYPO } from "@/lib/tokens";
import UserApprovalTable from "./_components/UserApprovalTable";

export const metadata: Metadata = { title: "사용자 관리 — lifestyle" };

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  is_approved: boolean;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}
interface MembershipRow {
  user_id: string;
  role: "owner" | "admin" | "member";
}

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 관리자 권한 체크
  const { data: me } = await supabase
    .from("organization_members")
    .select("role, organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    redirect("/dashboard");
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_approved, approved_at, rejected_at, rejection_reason, created_at")
    .order("is_approved", { ascending: true })
    .order("created_at", { ascending: false });

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("user_id, role");

  const memberRole = new Map<string, "owner" | "admin" | "member">();
  for (const m of (memberships ?? []) as MembershipRow[]) memberRole.set(m.user_id, m.role);

  const rows = ((profiles ?? []) as ProfileRow[]).map((p) => ({
    id:            p.id,
    email:         p.email,
    fullName:      p.full_name,
    isApproved:    p.is_approved,
    approvedAt:    p.approved_at,
    rejectedAt:    p.rejected_at,
    rejectionReason: p.rejection_reason,
    createdAt:     p.created_at,
    role:          memberRole.get(p.id) ?? null,
    isMe:          p.id === user.id,
  }));

  const pendingCount  = rows.filter((r) => !r.isApproved && !r.rejectedAt).length;
  const approvedCount = rows.filter((r) => r.isApproved).length;
  const rejectedCount = rows.filter((r) => !r.isApproved && r.rejectedAt).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[
          { label: "대시보드", href: "/dashboard" },
          { label: "관리" },
          { label: "사용자 관리" },
        ]}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="ADMIN"
            title="사용자 관리"
            subtitle="신규 가입자의 접근을 승인 · 거부하고, 기존 사용자의 권한을 관리합니다."
            meta={`총 ${rows.length}명`}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="승인 대기" value={pendingCount} color="text-amber-600" accent="bg-gradient-to-r from-amber-500 to-amber-300" />
            <Stat label="승인 완료" value={approvedCount} color="text-emerald-600" accent="bg-gradient-to-r from-emerald-600 to-emerald-400" />
            <Stat label="거부됨"    value={rejectedCount} color="text-rose-600" accent="bg-gradient-to-r from-rose-500 to-rose-300" />
          </div>

          <UserApprovalTable rows={rows} />

          <AppFooter />
        </div>
      </main>
    </div>
  );
}

function Stat({
  label, value, color, accent,
}: { label: string; value: number; color: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${accent}`} />
      <p className={TYPO.kpiLabel}>{label}</p>
      <p className={`mt-3 ${TYPO.kpiNumber} ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}
