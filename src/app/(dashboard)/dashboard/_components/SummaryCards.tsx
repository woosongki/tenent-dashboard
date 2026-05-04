import Link from "next/link";
import type { DashboardSummary } from "@/types/dashboard";
import { TYPO } from "@/lib/tokens";

interface Props {
  summary: DashboardSummary;
}

type Accent = "violet" | "emerald" | "amber" | "rose";
const ACCENT_BAR: Record<Accent, string> = {
  violet:  "bg-gradient-to-r from-violet-600 to-violet-400",
  emerald: "bg-gradient-to-r from-emerald-600 to-emerald-400",
  amber:   "bg-gradient-to-r from-amber-500 to-amber-300",
  rose:    "bg-gradient-to-r from-rose-500 to-rose-300",
};
const TREND: Record<"up"|"down"|"neutral", { dot: string; text: string; arrow: string }> = {
  up:      { dot: "bg-emerald-500", text: "text-emerald-600", arrow: "↗" },
  down:    { dot: "bg-rose-500",    text: "text-rose-600",    arrow: "↘" },
  neutral: { dot: "bg-slate-400",   text: "text-slate-500",   arrow: "→" },
};

interface KpiProps {
  href?: string;
  accent: Accent;
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  trend?: { direction: "up"|"down"|"neutral"; value: string; label: string };
}

function Kpi({ href, accent, label, value, unit, caption, trend }: KpiProps) {
  const Wrap: React.ElementType = href ? Link : "div";
  const wrapProps = href ? { href } : {};
  return (
    <Wrap
      {...wrapProps}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-all hover:shadow-[0_8px_24px_rgba(15,23,42,.08)] hover:-translate-y-0.5"
    >
      <span className={`absolute inset-x-0 top-0 h-[3px] ${ACCENT_BAR[accent]}`} />
      <p className={TYPO.kpiLabel}>{label}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={TYPO.kpiNumber}>{value}</span>
        {unit && <span className="text-[18px] font-semibold text-slate-400">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 min-h-[20px]">
        {caption ? <p className="text-[12px] text-slate-500">{caption}</p> : <span />}
        {trend && (
          <span className="inline-flex items-center gap-1 text-[11px]">
            <span className={`h-1.5 w-1.5 rounded-full ${TREND[trend.direction].dot}`} />
            <span className={`font-semibold tabular-nums ${TREND[trend.direction].text}`}>
              {TREND[trend.direction].arrow} {trend.value}
            </span>
            {trend.label && <span className="text-slate-400">{trend.label}</span>}
          </span>
        )}
      </div>
      {href && (
        <span className="absolute right-4 top-4 text-[10px] font-medium text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">
          상세 →
        </span>
      )}
    </Wrap>
  );
}

export default function SummaryCards({ summary }: Props) {
  const attraction = summary.attraction;
  const completionRate = attraction.total > 0
    ? Math.round((attraction.completed / attraction.total) * 100)
    : 0;
  const pool = summary.contentPoolBreakdown;
  const poolBreakdown = `라이프 ${pool.lifestyle} · F&B ${pool.fnb} · 팝업 ${pool.popup}`;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Kpi
        href="/dashboard/drilldown"
        accent="violet"
        label="공실 해결"
        value={summary.totalMembers.toLocaleString()}
        unit="건"
        caption="입점 진척 추적"
        trend={{ direction: "up", value: `${summary.pendingInvitations}`, label: "초대 대기" }}
      />
      <Kpi
        href="/dashboard/goals"
        accent="emerald"
        label="컨텐츠 풀"
        value={summary.contentPoolCount.toLocaleString()}
        unit="건"
        caption={poolBreakdown}
      />
      <Kpi
        href="/dashboard/goals?tab=popup"
        accent="amber"
        label="팝업 컨텍판"
        value={pool.popup.toLocaleString()}
        unit="건"
        caption="컨텍 진행 중인 팝업 후보"
      />
      <Kpi
        href="/dashboard/drilldown"
        accent="rose"
        label="입점 완료율"
        value={completionRate.toString()}
        unit="%"
        caption={`${attraction.completed} / ${attraction.total} · 진행중 ${attraction.inProgress}`}
        trend={{
          direction: completionRate >= 50 ? "up" : "neutral",
          value: `${completionRate}%`,
          label: "",
        }}
      />
    </div>
  );
}
