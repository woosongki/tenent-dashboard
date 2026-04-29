import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/goals/queries";
import GoalsTable from "./_components/GoalsTable";
import AddGoalForm from "./_components/AddGoalForm";

export const metadata: Metadata = { title: "목표 관리 — Gana" };

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
          <StatChip label="달성" value={completed}    color="text-indigo-600" />
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
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <span className="text-sm font-semibold text-gray-800">목표 관리</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-5 sm:px-6 sm:py-8 sm:space-y-6">
        {/* 페이지 타이틀 + 추가 버튼 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">목표치 관리</h1>
            <p className="mt-0.5 text-sm text-gray-400">셀을 클릭하면 바로 수정할 수 있습니다.</p>
          </div>
          {orgId && <AddGoalForm organizationId={orgId} />}
        </div>

        {/* 조직이 없는 경우 */}
        {!orgId ? (
          <div className="rounded-2xl bg-white py-16 text-center ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">소속 조직이 없습니다. 먼저 조직을 생성해주세요.</p>
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
    <div className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 ring-1 ring-gray-200">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
