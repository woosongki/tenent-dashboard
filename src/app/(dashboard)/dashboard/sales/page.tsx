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

export const metadata: Metadata = { title: "판매 분석 — Gana" };

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
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href="/dashboard"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <span className="text-sm font-semibold text-gray-800">판매 분석</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-5 sm:px-6 sm:py-8 sm:space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">판매 분석</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            카테고리·브랜드별 매출 및 이익 현황 (2026-04-01 vs 2025-04-02)
          </p>
        </div>

        <Suspense fallback={<ContentSkeleton />}>
          <SalesContent />
        </Suspense>
      </main>
    </div>
  );
}
