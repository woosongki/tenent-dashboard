import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSummary } from "@/lib/dashboard/queries";
import { getLastUpdatedMax } from "@/lib/dashboard/lastUpdated";
import SummaryCards from "./_components/SummaryCards";
import SalesRankingDual from "./_components/SalesRankingDual";
import CategoryDonutChart from "./_components/CategoryDonutChart";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "대시보드 — lifestyle" };

function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-white border border-[#e8ecf0]" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-white border border-[#e8ecf0]" />
      <div className="h-64 rounded-xl bg-white border border-[#e8ecf0]" />
    </div>
  );
}

async function SummarySection() {
  const summary = await getDashboardSummary();
  return (
    <>
      <SummaryCards summary={summary} />
      <CategoryDonutChart stats={summary.categoryStats} />
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">매출 성장 순위</h2>
          <a
            href="/dashboard/sales"
            className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
          >
            전체 보기
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        <SalesRankingDual byRevenue={summary.topByRevenue} byGrowth={summary.topByGrowth} />
      </section>
    </>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lastUpdated = await getLastUpdatedMax([
    "goals", "attraction_status", "vendor_fnb",
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드" }]}
        lastUpdated={lastUpdated}
        action={
          <span className="hidden text-[12px] text-slate-400 sm:inline">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric", month: "long", day: "numeric", weekday: "long",
            })}
          </span>
        }
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">브랜드 성과</h1>
          <p className="mt-1 text-[13px] text-slate-400">매출·입점·팝업 현황을 한눈에 — 셀 클릭으로 드릴다운</p>
        </div>

        <Suspense fallback={<SummarySkeleton />}>
          <SummarySection />
        </Suspense>
      </main>
    </div>
  );
}
