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
          <h2 className="text-[14px] font-bold text-slate-800">구매그룹별 매출</h2>
          <GroupComparisonTable groups={groups} />
        </section>

        {/* 브랜드 표 (전체) */}
        <section className="space-y-3">
          <h2 className="text-[14px] font-bold text-slate-800">
            브랜드별 매출 ({brands.length}개)
          </h2>
          <BrandComparisonTable brands={brands} />
        </section>

          <p className="text-[10px] text-slate-400">
            데이터 출처: {meta.compiledAt} 변환 · CSV 원본 일매출 2기간 비교분석
          </p>

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
