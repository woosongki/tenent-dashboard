import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSummary } from "@/lib/dashboard/queries";
import { signOutAction } from "@/app/(auth)/login/_actions/auth";
import SummaryCards from "./_components/SummaryCards";
import GrowthRankingTable from "./_components/GrowthRankingTable";
import { SummaryCardsSkeleton } from "./_components/DashboardSkeleton";

export const metadata: Metadata = { title: "대시보드 — lifestyle" };

async function SummarySection() {
  const summary = await getDashboardSummary();
  return (
    <>
      <SummaryCards summary={summary} />
      {/* 매출 성장 순위 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">매출 성장 순위</h2>
          <a
            href="/dashboard/sales"
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            전체 보기 →
          </a>
        </div>
        <GrowthRankingTable brands={summary.topBrands} />
      </section>
    </>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = user.user_metadata?.full_name ?? user.email;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              G
            </span>
            <span className="text-sm font-semibold text-gray-800">lifestyle</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-[140px] truncate text-sm text-gray-500 sm:block">{displayName}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-6 sm:py-8 sm:space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-1 text-sm text-gray-400">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric", month: "long", day: "numeric", weekday: "long",
            })}
          </p>
        </div>

        {/* Quick Nav */}
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            { href: "/dashboard/sales",     label: "판매분석",     desc: "카테고리·브랜드별 매출·이익",  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { href: "/dashboard/drilldown", label: "유치현황",     desc: "채널별 유치 성과 현황",         icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
            { href: "/dashboard/goals",     label: "컨텐츠 POOL", desc: "브랜드 컨텐츠 관리",            icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
            { href: "/dashboard/logs",      label: "활동로그",     desc: "변경 이력 및 감사 기록",        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
          ].map(({ href, label, desc, icon }) => (
            <a
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all sm:p-4"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{label}</p>
                <p className="mt-0.5 text-xs text-gray-400 truncate">{desc}</p>
              </div>
            </a>
          ))}
        </nav>

        {/* Summary Cards + 성장 순위 테이블 */}
        <Suspense fallback={<SummaryCardsSkeleton />}>
          <SummarySection />
        </Suspense>

      </main>
    </div>
  );
}
