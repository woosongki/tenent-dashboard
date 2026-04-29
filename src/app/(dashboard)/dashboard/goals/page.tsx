import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/goals/queries";
import GoalsTable from "./_components/GoalsTable";
import AddGoalForm from "./_components/AddGoalForm";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "컨텐츠 POOL — lifestyle" };

async function GoalsContent({ orgId }: { orgId: string }) {
  const goals = await getGoals(orgId);

  const total     = goals.length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const atRisk    = goals.filter((g) => g.status === "at_risk" || g.status === "behind").length;

  return (
    <div className="space-y-6">
      {/* 요약 배너 */}
      {total > 0 && (
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <StatChip label="전체" value={total}        color="text-gray-700" />
          <StatChip label="달성" value={completed}    color="text-violet-600" />
          <StatChip label="주의" value={atRisk}       color="text-rose-500" />
          <StatChip label="진행" value={total - completed - atRisk} color="text-emerald-600" />
        </div>
      )}
      <GoalsTable goals={goals} />
    </div>
  );
}

function GoalsTableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-8 w-32 rounded-lg bg-gray-100" />
        <div className="h-8 w-28 rounded-lg bg-gray-100" />
      </div>
      <div className="rounded-2xl bg-white ring-1 ring-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex gap-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-3 w-16 rounded bg-gray-100" />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b border-gray-50 px-4 py-3.5 last:border-0">
            <div className="h-4 w-32 rounded bg-gray-100" />
            <div className="h-4 w-14 rounded-full bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-2 w-24 rounded-full bg-gray-100 self-center" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 첫 번째 소속 조직 조회
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgId = membership?.organization_id;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "컨텐츠 POOL" }]}
        action={orgId ? <AddGoalForm organizationId={orgId} /> : undefined}
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">컨텐츠 POOL</h1>
          <p className="mt-1 text-[13px] text-slate-400">셀을 클릭하면 바로 수정할 수 있습니다.</p>
        </div>
        {!orgId ? (
          <div className="rounded-xl bg-white py-16 text-center border border-[#e8ecf0]">
            <p className="text-sm text-slate-400">소속 조직이 없습니다.</p>
          </div>
        ) : (
          <Suspense fallback={<GoalsTableSkeleton />}>
            <GoalsContent orgId={orgId} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function StatChip({
  label, value, color,
}: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-[#e8ecf0] bg-white px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
