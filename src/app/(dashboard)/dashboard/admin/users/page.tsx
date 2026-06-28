import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE, TYPO } from "@/lib/tokens";
import UserApprovalTable from "./_components/UserApprovalTable";
import FeedbackInbox from "./_components/FeedbackInbox";
import type { Feedback, FeedbackStatus } from "@/lib/feedback";

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
  hidden_menus: string[] | null;
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
    .select("user_id, role, hidden_menus");

  const { data: feedbackRows } = await supabase
    .from("app_feedback")
    .select("id, author_email, category, message, status, created_at")
    .order("created_at", { ascending: false });
  const feedback: Feedback[] = ((feedbackRows ?? []) as {
    id: string; author_email: string | null; category: string | null;
    message: string; status: string; created_at: string;
  }[]).map((f) => ({
    id: f.id, authorEmail: f.author_email, category: f.category,
    message: f.message, status: (f.status as FeedbackStatus) ?? "new", createdAt: f.created_at,
  }));

  const memberRole = new Map<string, "owner" | "admin" | "member">();
  const memberHidden = new Map<string, string[]>();
  for (const m of (memberships ?? []) as MembershipRow[]) {
    memberRole.set(m.user_id, m.role);
    memberHidden.set(m.user_id, m.hidden_menus ?? []);
  }

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
    hiddenMenus:   memberHidden.get(p.id) ?? [],
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

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Stat label="승인 대기" value={pendingCount} accent="bg-yellow-300"   accentText="text-[#0a0a0a]" />
            <Stat label="승인 완료" value={approvedCount} accent="bg-emerald-400" accentText="text-emerald-950" />
            <Stat label="거부됨"    value={rejectedCount} accent="bg-rose-500"    accentText="text-white" />
          </div>

          <UserApprovalTable rows={rows} />

          <FeedbackInbox items={feedback} />

          <AppFooter />
        </div>
      </main>
    </div>
  );
}

function Stat({
  label, value, accent, accentText,
}: { label: string; value: number; accent: string; accentText: string }) {
  return (
    <div className="brutal bg-white p-5 flex flex-col">
      <div className={`flex items-center justify-between px-3 py-2 border-[2px] border-[#0a0a0a] ${accent} ${accentText}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{label}</span>
      </div>
      <p className={`mt-5 ${TYPO.kpiNumber}`}>{value.toLocaleString()}</p>
    </div>
  );
}
