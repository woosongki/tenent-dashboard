import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAttractionRows, getAttractionStats } from "@/lib/attraction/queries";
import BranchAttractionView from "./_components/BranchAttractionView";
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
      <div className="brutal bg-white overflow-hidden">
        <div className="border-b border-[#0a0a0a]/10 bg-[#F1ECDB] px-4 py-3 flex gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 w-14 rounded bg-slate-100" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b border-[#0a0a0a]/10 px-4 py-3.5 last:border-0">
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
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard label="전체 브랜드" value={stats.total}          accent="violet" />
        <StatCard label="유치 완료"   value={stats.completed}      accent="emerald" />
        <StatCard label="진행중"      value={stats.inProgress}     accent="amber" />
        <StatCard label="완료율"      value={`${completionRate}%`} accent="rose" />
      </div>

      {/* Progress bar */}
      <div className="brutal bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]">유치 진행률</span>
          <span className="font-mono text-[13px] font-extrabold text-[#0a0a0a] tabular-nums">
            {stats.completed} / {stats.total}
          </span>
        </div>
        <div className="h-3 w-full border-[2px] border-[#0a0a0a] bg-white overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, cnt]) => (
              <span key={cat} className="text-[11px] font-bold text-[#0a0a0a]/60 uppercase tracking-wider">
                {cat} <span className="font-mono font-extrabold text-[#0a0a0a]">{cnt}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Branch heatmap + Table */}
      <BranchAttractionView rows={rows} />
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  violet:  "bg-violet-500 text-white",
  emerald: "bg-emerald-400 text-emerald-950",
  amber:   "bg-yellow-300 text-[#0a0a0a]",
  rose:    "bg-rose-500 text-white",
};

function StatCard({
  label, value, accent,
}: {
  label: string;
  value: number | string;
  accent: "violet" | "emerald" | "amber" | "rose";
}) {
  return (
    <div className="brutal bg-white p-5">
      <div className={`flex items-center justify-between px-3 py-2 border-[2px] border-[#0a0a0a] ${ACCENT_BG[accent]}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{label}</span>
      </div>
      <p className="mt-4 font-mono text-[40px] font-extrabold leading-none tabular-nums tracking-tight text-[#0a0a0a]">
        {value}
      </p>
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
