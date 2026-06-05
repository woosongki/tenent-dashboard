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
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";

export const metadata: Metadata = { title: "대시보드 — lifestyle" };

function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 brutal bg-[#F1ECDB]" />
        ))}
      </div>
      <div className="h-56 brutal bg-[#F1ECDB]" />
      <div className="h-72 brutal bg-[#F1ECDB]" />
    </div>
  );
}

async function SummarySection() {
  const summary = await getDashboardSummary();
  return (
    <>
      <SummaryCards summary={summary} />

      <SectionCard
        eyebrow="CATEGORY"
        title="카테고리 분포"
        description="브랜드 매출 합산 기준 — 도넛 영역 클릭 시 매출분석으로 이동"
      >
        <CategoryDonutChart stats={summary.categoryStats} />
      </SectionCard>

      <SectionCard
        eyebrow="GROWTH"
        title="매출 성장 순위"
        description="전년 동기 대비 매출액 성장 베스트 5 / 매출성장율 베스트 5"
        action={
          <a
            href="/dashboard/sales"
            className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a] hover:bg-yellow-300 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#0a0a0a] transition-all"
          >
            전체 보기
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        }
      >
        <SalesRankingDual byGrowthAmount={summary.topByGrowthAmount} byGrowth={summary.topByGrowth} />
      </SectionCard>
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
  const todayStr = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드" }]}
        lastUpdated={lastUpdated}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="OVERVIEW"
            title="브랜드 성과"
            subtitle="매출 · 입점 · 팝업 현황을 한눈에 파악하고, 카드를 클릭해 상세 페이지로 드릴다운하세요."
            meta={todayStr}
          />

          <Suspense fallback={<SummarySkeleton />}>
            <SummarySection />
          </Suspense>

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
