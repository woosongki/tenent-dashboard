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
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat
              label="공실 해결 (KPI)"
              value={resolvedCount}
              caption={`${resolvedRows.length}건 · 리징·리빙 × 3·4단계`}
              accent="violet"
            />
            <Stat
              label="전체 공실"
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
              label="리징 / 리빙"
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

const ACCENT_BG: Record<string, string> = {
  violet:  "bg-violet-500 text-white",
  emerald: "bg-emerald-400 text-emerald-950",
  rose:    "bg-rose-500 text-white",
  slate:   "bg-[#F1ECDB] text-[#0a0a0a]",
};

function Stat({
  label, value, caption, accent,
}: {
  label: string;
  value: number;
  caption?: string;
  accent: "violet" | "emerald" | "rose" | "slate";
}) {
  return (
    <div className="brutal bg-white p-5">
      <div className={`flex items-center justify-between px-3 py-2 border-[2px] border-[#0a0a0a] ${ACCENT_BG[accent]}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{label}</span>
      </div>
      <p className="mt-4 font-mono text-[40px] font-extrabold leading-none tabular-nums tracking-tight text-[#0a0a0a]">
        {value.toLocaleString()}
        <span className="ml-1 text-[14px] font-extrabold text-[#0a0a0a]/55 font-sans">건</span>
      </p>
      {caption && <p className="mt-2 text-[11px] font-medium text-[#0a0a0a]/65 leading-tight">{caption}</p>}
    </div>
  );
}
