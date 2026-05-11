import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getVacancyRows,
  getVacancyMeta,
  getVacancyResolvedCount,
  isResolvedRow,
} from "@/lib/vacancy";
import VacancyTable from "./_components/VacancyTable";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";

export const metadata: Metadata = { title: "공실해결 — lifestyle" };

export default async function VacancyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rows = getVacancyRows();
  const meta = getVacancyMeta();
  const resolvedCount = getVacancyResolvedCount();

  // 진척 단계별 카운트
  const byStage = rows.reduce<Record<string, number>>((acc, r) => {
    if (r.stage) acc[r.stage] = (acc[r.stage] ?? 0) + 1;
    return acc;
  }, {});

  // 담당 카테고리 — 리징/리빙 카운트
  const livingCount = rows.filter((r) => r.category === "리빙").length;
  const leasingCount = rows.filter((r) => r.category === "리징").length;

  // KPI 대상 행만 추린 미리보기 (상단 표시는 안 하고, 페이지 KPI 카드용)
  const resolvedRows = rows.filter(isResolvedRow);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "공실해결" }]}
        lastUpdated={meta.importedAt}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} space-y-6 flex flex-col`}>
          <PageHeader
            eyebrow="VACANCY"
            title="공실해결"
            subtitle="공실 발생 자리의 대안 브랜드 진척 현황 — 담당 카테고리가 리징·리빙이고 진척사항이 3·4단계인 건이 KPI 대상."
            meta={`데이터 출처: ${meta.source}`}
          />

          {/* ── 상단 KPI ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="공실 해결 (KPI)"
              value={resolvedCount}
              caption={`${resolvedRows.length}건 · 리징·리빙 × 3·4단계`}
              accent="violet"
            />
            <Stat
              label="전체 공실 건수"
              value={rows.length}
              caption={meta.source}
              accent="slate"
            />
            <Stat
              label="4단계 (오픈/계약)"
              value={byStage["4단계"] ?? 0}
              caption="입점 확정·오픈 단계"
              accent="emerald"
            />
            <Stat
              label="리징/리빙"
              value={leasingCount + livingCount}
              caption={`리징 ${leasingCount} · 리빙 ${livingCount}`}
              accent="rose"
            />
          </div>

          {/* ── 표 ── */}
          <VacancyTable rows={rows} />

          <AppFooter />
        </div>
      </main>
    </div>
  );
}

const ACCENT_BAR: Record<string, string> = {
  violet:  "bg-gradient-to-r from-violet-600 to-violet-400",
  emerald: "bg-gradient-to-r from-emerald-600 to-emerald-400",
  rose:    "bg-gradient-to-r from-rose-500 to-rose-300",
  slate:   "bg-gradient-to-r from-slate-400 to-slate-300",
};

function Stat({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: number;
  caption?: string;
  accent: "violet" | "emerald" | "rose" | "slate";
}) {
  return (
    <div className="relative overflow-hidden  border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${ACCENT_BAR[accent]}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-500">{label}</p>
      <p className="mt-2 text-[32px] font-bold tabular-nums leading-none text-slate-900">
        {value.toLocaleString()}
        <span className="ml-1 text-[14px] font-semibold text-slate-400">건</span>
      </p>
      {caption && <p className="mt-1.5 text-[11px] text-slate-500">{caption}</p>}
    </div>
  );
}
