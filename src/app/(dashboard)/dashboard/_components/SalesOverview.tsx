import Link from "next/link";
import SectionCard from "@/components/ui/SectionCard";
import CategoryMovers from "./CategoryMovers";
import type { SalesOverview } from "@/lib/dashboard/salesOverview";

const eok = (n: number) => (n / 1e8).toFixed(1);

function Yoy({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold tabular-nums px-1.5 py-0.5 border-[2px] border-[#0a0a0a] ${up ? "bg-emerald-400 text-emerald-950" : "bg-rose-500 text-white"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function SalesCard({ href, accentBg, accentText, label, value, unit, caption, trend, alert }: {
  href: string; accentBg: string; accentText: string; label: string;
  value: string; unit?: string; caption?: string;
  trend?: number; alert?: boolean;
}) {
  return (
    <Link href={href} className="brutal brutal-hover bg-white p-4 flex flex-col">
      <div className={`flex items-center justify-between px-3 py-1.5 border-[2px] border-[#0a0a0a] ${accentBg} ${accentText}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{label}</span>
        <span className="text-[12px] font-extrabold">→</span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className={`font-mono font-extrabold tabular-nums tracking-tight leading-none text-[#0a0a0a] ${alert ? "text-[40px]" : "text-[40px]"}`}>{value}</span>
        {unit && <span className="text-[16px] font-extrabold text-[#0a0a0a]/55 font-mono">{unit}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 min-h-[22px]">
        {caption ? <p className="text-[11px] font-medium text-[#0a0a0a]/65 leading-tight">{caption}</p> : <span />}
        {trend !== undefined && <Yoy pct={trend} />}
      </div>
    </Link>
  );
}

export default function SalesOverviewSection({ data }: { data: SalesOverview }) {
  return (
    <div className="space-y-8">
      {/* 매출 핵심 카드 (라이브 Supabase) */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SalesCard href="/dashboard/sales" accentBg="bg-yellow-300" accentText="text-[#0a0a0a]"
          label="누적 매출" value={eok(data.cumTotal)} unit="억" trend={data.cumYoy}
          caption={`${data.cumLabel} · 전년 ${eok(data.cumPrev)}억`} />
        <SalesCard href="/dashboard/sales" accentBg="bg-cyan-400" accentText="text-[#0a0a0a]"
          label="당월 매출" value={data.monthTotal != null ? eok(data.monthTotal) : "—"} unit={data.monthTotal != null ? "억" : undefined}
          trend={data.monthYoy ?? undefined} caption={data.monthLabel || "당월 데이터 없음"} />
        <SalesCard href="/dashboard/sales" accentBg="bg-amber-400" accentText="text-[#0a0a0a]"
          label="이탈 (당월 빠짐)" value={data.leftCount.toLocaleString()} unit="건" alert
          caption="누적 매출 있으나 당월 실적 없음 → 점검" />
        <SalesCard href="/dashboard/sales" accentBg="bg-rose-500" accentText="text-white"
          label="퇴점 (올해 미영업)" value={data.closedCount.toLocaleString()} unit="건" alert
          caption="전년 실적 있으나 올해 매출 없음" />
      </div>

      {/* 부문별 매출 */}
      <SectionCard eyebrow="DIVISION" title="부문별 매출" description={`${data.cumLabel} · 패션 → F&B → 라이프스타일 · 클릭 시 매출분석`}>
        <div className="border-[2px] border-[#0a0a0a] bg-white divide-y divide-slate-100">
          {data.divisions.map((d) => {
            const max = Math.max(...data.divisions.map((x) => x.s), 1);
            return (
              <div key={d.division} className="flex items-center gap-3 px-3 py-2.5 text-[12px]">
                <span className="w-24 shrink-0 font-bold text-[#0a0a0a]">{d.division}</span>
                <div className="flex-1 h-3 bg-slate-100"><div className="h-full bg-violet-400" style={{ width: `${(d.s / max) * 100}%` }} /></div>
                <span className="w-16 text-right font-mono font-extrabold">{eok(d.s)}억</span>
                <span className="w-16 text-right"><Yoy pct={d.yoyPct} /></span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 카테고리별 TOP5 — 성장액 기준 */}
      <SectionCard eyebrow="MOVERS" title="카테고리별 TOP5 (성장액)"
        description={`${data.monthLabel || "당월"} · 성장액(올해−전년동월, 백만) · 전년동월 없는 신규는 제외(아래 매출액 위젯에 포함) · 클릭하면 5개`}
        action={
          <Link href="/dashboard/sales" className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a] hover:bg-yellow-300 transition-all">
            전체 보기 →
          </Link>
        }>
        <CategoryMovers catMovers={data.catMoversByGrowth} metric="growth" />
      </SectionCard>

      {/* 카테고리별 TOP5 — 매출액 기준 */}
      <SectionCard eyebrow="MOVERS" title="카테고리별 TOP5 (매출액)"
        description={`${data.monthLabel || "당월"} · 매출액(백만) 기준 · 카테고리 클릭하면 5개 펼침`}
        action={
          <Link href="/dashboard/sales" className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a] hover:bg-yellow-300 transition-all">
            전체 보기 →
          </Link>
        }>
        <CategoryMovers catMovers={data.catMoversBySales} metric="sales" />
      </SectionCard>
    </div>
  );
}
