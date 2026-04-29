import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAttractionRows, getAttractionStats } from "@/lib/attraction/queries";
import AttractionTable from "./_components/AttractionTable";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "입점 현황 — lifestyle" };

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded-full bg-gray-100" />
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 w-14 rounded bg-gray-100" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b border-gray-50 px-4 py-3.5 last:border-0">
            <div className="h-4 w-24 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-4 w-12 rounded bg-gray-100" />
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-4 w-12 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-4 w-14 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function AttractionContent() {
  const [rows, stats] = await Promise.all([getAttractionRows(), getAttractionStats()]);
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="전체 브랜드" value={stats.total} color="indigo" />
        <StatCard label="유치 완료" value={stats.completed} color="emerald" />
        <StatCard label="진행중" value={stats.inProgress} color="amber" />
        <StatCard label="완료율" value={`${completionRate}%`} color="violet" />
      </div>

      {/* Progress bar */}
      <div className="rounded-xl bg-white ring-1 ring-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">유치 진행률</span>
          <span className="text-xs font-semibold text-gray-800">{stats.completed} / {stats.total}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-2.5 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, cnt]) => (
              <span key={cat} className="text-xs text-gray-500">
                {cat} <span className="font-semibold text-gray-700">{cnt}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Table */}
      <AttractionTable rows={rows} />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: "indigo" | "emerald" | "amber" | "violet" }) {
  const colors = {
    indigo:  { ring: "ring-indigo-100",  bg: "bg-indigo-50",  text: "text-indigo-700" },
    emerald: { ring: "ring-emerald-100", bg: "bg-emerald-50", text: "text-emerald-700" },
    amber:   { ring: "ring-amber-100",   bg: "bg-amber-50",   text: "text-amber-700" },
    violet:  { ring: "ring-violet-100",  bg: "bg-violet-50",  text: "text-violet-700" },
  };
  const c = colors[color];
  return (
    <div className={`rounded-xl bg-white ring-1 ${c.ring} p-4 shadow-sm`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}

export default async function DrilldownPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "입점 현황" }]} />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">입점 현황</h1>
          <p className="mt-1 text-[13px] text-slate-400">이랜드리테일 컨텐츠 유치 현황 데이터입니다.</p>
        </div>
        <Suspense fallback={<TableSkeleton />}>
          <AttractionContent />
        </Suspense>
      </main>
    </div>
  );
}
