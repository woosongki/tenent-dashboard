import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getSalesMeta,
  getOverallTotal,
  getMonthSummary,
  getGroups,
  getBrands,
} from "@/lib/sales/csvData";
import MonthlyComparisonChart from "./_components/MonthlyComparisonChart";
import SalesSummaryCards from "./_components/SalesSummaryCards";
import GroupComparisonTable from "./_components/GroupComparisonTable";
import BrandComparisonTable from "./_components/BrandComparisonTable";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";

export const metadata: Metadata = { title: "매출분석 — lifestyle" };

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = getSalesMeta();
  const overall = getOverallTotal();
  const monthly = getMonthSummary();
  const groups = getGroups();
  const brands = getBrands();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "매출분석" }]}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="SALES ANALYTICS"
            title="매출분석"
            subtitle="구매그룹 4분류 · 월별 작년/올해 비교"
            meta={`${meta.period1} vs ${meta.period2} · 브랜드 ${brands.length}개`}
          />

        {/* 종합 + 월별 차트 */}
        <SalesSummaryCards overall={overall} monthly={monthly} />
        <MonthlyComparisonChart monthly={monthly} />

        {/* 그룹별 표 */}
        <section className="space-y-3">
          <div className="inline-block border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1 shadow-[2px_2px_0_0_#0a0a0a]">
            <h2 className="font-display text-[18px] leading-none text-[#0a0a0a]">구매그룹별 매출</h2>
          </div>
          <GroupComparisonTable groups={groups} />
        </section>

        {/* 브랜드 표 (전체) */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1 shadow-[2px_2px_0_0_#0a0a0a]">
            <h2 className="font-display text-[18px] leading-none text-[#0a0a0a]">브랜드별 매출</h2>
            <span className="font-mono text-[12px] font-extrabold tabular-nums text-[#0a0a0a]">{brands.length}</span>
          </div>
          <BrandComparisonTable brands={brands} />
        </section>

          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
            데이터 출처 <span className="font-mono">{meta.compiledAt}</span> 변환 · CSV 일매출 2기간 비교
          </p>

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
