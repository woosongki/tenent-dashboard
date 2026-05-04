import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
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
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">사용자 관리</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            관리자 승인 대기 · 승인/거부 · 권한 박탈
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="승인 대기" value={pendingCount} color="text-amber-600" />
          <Stat label="승인 완료" value={approvedCount} color="text-emerald-600" />
          <Stat label="거부됨"    value={rejectedCount} color="text-rose-600" />
        </div>

        <UserApprovalTable rows={rows} />
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#e8ecf0] bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-[22px] font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}
