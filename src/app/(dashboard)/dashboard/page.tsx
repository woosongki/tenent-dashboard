import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSalesOverview } from "@/lib/dashboard/salesOverview";
import { getLastUpdatedMax } from "@/lib/dashboard/lastUpdated";
import SalesOverviewSection from "./_components/SalesOverview";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
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
  let sales = null;
  try { sales = await getSalesOverview(); }
  catch (e) { console.error("[dashboard] 매출 요약 로드 실패:", e); }
  return sales
    ? <SalesOverviewSection data={sales} />
    : <div className="border-[2px] border-dashed border-slate-300 p-8 text-center text-[13px] text-slate-400">매출 데이터를 불러오지 못했습니다.</div>;
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
            subtitle="당월·누적 매출과 이탈·퇴점, 부문별·카테고리별 성장·매출 TOP을 한눈에. 카드·카테고리를 눌러 매출분석으로 드릴다운하세요."
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
