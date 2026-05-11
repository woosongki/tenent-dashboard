import Link from "next/link";
import type { DashboardSummary } from "@/types/dashboard";
import { TYPO } from "@/lib/tokens";

interface Props {
  summary: DashboardSummary;
}

type Accent = "teal" | "magenta" | "yellow" | "violet" | "ink";

const ACCENT_BG: Record<Accent, string> = {
  teal:    "bg-cyan-400",
  magenta: "bg-fuchsia-500",
  yellow:  "bg-yellow-300",
  violet:  "bg-violet-500",
  ink:     "bg-[#0a0a0a]",
};
const ACCENT_TEXT: Record<Accent, string> = {
  teal:    "text-[#0a0a0a]",
  magenta: "text-white",
  yellow:  "text-[#0a0a0a]",
  violet:  "text-white",
  ink:     "text-white",
};
const TREND: Record<"up"|"down"|"neutral", { bg: string; arrow: string }> = {
  up:      { bg: "bg-emerald-400 text-emerald-950", arrow: "↗" },
  down:    { bg: "bg-rose-500 text-white",          arrow: "↘" },
  neutral: { bg: "bg-[#F1ECDB] text-[#0a0a0a]",     arrow: "→" },
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
      className="brutal brutal-hover bg-white p-5 flex flex-col"
    >
      <div className={`flex items-center justify-between px-3 py-2 border-[2px] border-[#0a0a0a] ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{label}</span>
        {href && <span className="text-[12px] font-extrabold">→</span>}
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className={TYPO.kpiNumber}>{value}</span>
        {unit && <span className="text-[20px] font-extrabold text-[#0a0a0a]/60 font-mono">{unit}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 min-h-[22px]">
        {caption ? (
          <p className="text-[11.5px] font-medium text-[#0a0a0a]/70 leading-tight">{caption}</p>
        ) : <span />}
        {trend && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold tabular-nums px-2 py-0.5 border-[2px] border-[#0a0a0a] ${TREND[trend.direction].bg}`}>
            {TREND[trend.direction].arrow} {trend.value}
            {trend.label && <span className="font-bold normal-case opacity-80">{trend.label}</span>}
          </span>
        )}
      </div>
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
    <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
      <Kpi
        href="/dashboard/drilldown"
        accent="teal"
        label="공실 해결"
        value={summary.totalMembers.toLocaleString()}
        unit="건"
        caption="입점 진척 추적"
        trend={{ direction: "up", value: `${summary.pendingInvitations}`, label: " 대기" }}
      />
      <Kpi
        href="/dashboard/goals"
        accent="magenta"
        label="컨텐츠 풀"
        value={summary.contentPoolCount.toLocaleString()}
        unit="건"
        caption={poolBreakdown}
      />
      <Kpi
        href="/dashboard/goals?tab=popup"
        accent="yellow"
        label="팝업 컨텍판"
        value={pool.popup.toLocaleString()}
        unit="건"
        caption="컨텍 진행 중 팝업 후보"
      />
      <Kpi
        href="/dashboard/drilldown"
        accent="violet"
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
