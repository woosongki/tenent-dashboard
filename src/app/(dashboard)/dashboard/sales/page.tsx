import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getPerformanceSummary,
  getPerformanceByCategory,
  getPerformanceRows,
} from "@/lib/performance/queries";
import PerformanceCards from "./_components/PerformanceCards";
import CategoryChart from "./_components/CategoryChart";
import PerformanceTable from "./_components/PerformanceTable";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "매출분석 — lifestyle" };

async function SalesContent() {
  const [summary, subtotals, rows] = await Promise.all([
    getPerformanceSummary(),
    getPerformanceByCategory(),
    getPerformanceRows(),
  ]);

  if (!summary) {
    return (
      <div className="rounded-xl bg-white py-16 text-center border border-gray-100 shadow-sm">
        <p className="text-sm text-gray-400">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PerformanceCards summary={summary} />
      <CategoryChart subtotals={subtotals} />
      <PerformanceTable rows={rows} />
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-gray-100 bg-white shadow-sm" />
        ))}
      </div>
      <div className="h-[240px] rounded-xl border border-gray-100 bg-white shadow-sm" />
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b border-gray-50 px-4 py-3 last:border-0">
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-4 w-32 rounded bg-gray-100" />
            <div className="h-4 w-24 rounded bg-gray-100 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "매출분석" }]} />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">매출분석</h1>
          <p className="mt-1 text-[13px] text-slate-400">카테고리·브랜드별 매출 및 이익 현황</p>
        </div>
        <Suspense fallback={<ContentSkeleton />}>
          <SalesContent />
        </Suspense>
      </main>
    </div>
  );
}
