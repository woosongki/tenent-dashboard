import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAttractionRows, getAttractionStats } from "@/lib/attraction/queries";
import AttractionTable from "./_components/AttractionTable";
import BranchProgressGrid from "./_components/BranchProgressGrid";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";

export const metadata: Metadata = { title: "입점계획(26년) — lifestyle" };

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded-full bg-slate-100" />
        ))}
      </div>
      <div className="rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
        <div className="border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-3 flex gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 w-14 rounded bg-slate-100" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b border-[#f8fafc] px-4 py-3.5 last:border-0">
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-4 w-12 rounded bg-slate-100" />
            <div className="h-4 w-20 rounded bg-slate-100" />
            <div className="h-4 w-12 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-4 w-14 rounded bg-slate-100" />
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
        <StatCard label="전체 브랜드" value={stats.total}          accent="violet" />
        <StatCard label="유치 완료"   value={stats.completed}      accent="emerald" />
        <StatCard label="진행중"      value={stats.inProgress}     accent="amber" />
        <StatCard label="완료율"      value={`${completionRate}%`} accent="rose" />
      </div>

      {/* Progress bar */}
      <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600">유치 진행률</span>
          <span className="text-xs font-semibold text-slate-800 tabular-nums">
            {stats.completed} / {stats.total}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, cnt]) => (
              <span key={cat} className="text-xs text-slate-400">
                {cat} <span className="font-semibold text-slate-600">{cnt}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Branch heatmap */}
      <BranchProgressGrid rows={rows} />

      {/* Table */}
      <AttractionTable rows={rows} />
    </div>
  );
}

const ACCENT_MAP = {
  violet:  { grad: "from-violet-600 to-violet-400", text: "text-violet-700",  bg: "bg-violet-50" },
  emerald: { grad: "from-emerald-600 to-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50" },
  amber:   { grad: "from-amber-500 to-amber-300",   text: "text-amber-700",   bg: "bg-amber-50" },
  rose:    { grad: "from-rose-500 to-rose-300",     text: "text-rose-700",    bg: "bg-rose-50" },
};

function StatCard({
  label, value, accent,
}: {
  label: string;
  value: number | string;
  accent: keyof typeof ACCENT_MAP;
}) {
  const c = ACCENT_MAP[accent];
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className={`absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r ${c.grad}`} />
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${c.text}`}>{value}</p>
    </div>
  );
}

export default async function DrilldownPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "입점계획(26년)" }]}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="ATTRACTION 2026"
            title="입점계획 2026"
            subtitle="34개 지점 · 브랜드별 컨텐츠 유치 현황을 관리합니다."
          />
          <Suspense fallback={<TableSkeleton />}>
            <AttractionContent />
          </Suspense>

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
