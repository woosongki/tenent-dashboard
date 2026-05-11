import { formatKRWCompact } from "@/lib/sales/format";
import type { PeriodTotals, MonthSummary } from "@/lib/sales/csvData";

interface Props {
  overall: PeriodTotals | null;
  monthly: MonthSummary[];
}

type Accent = "violet" | "emerald" | "sky" | "amber";

const ACCENT_BG: Record<Accent, string> = {
  violet:  "bg-violet-500 text-white",
  emerald: "bg-emerald-400 text-emerald-950",
  sky:     "bg-cyan-400 text-cyan-950",
  amber:   "bg-yellow-300 text-[#0a0a0a]",
};

export default function SalesSummaryCards({ overall, monthly }: Props) {
  if (!overall) return null;

  const sortedByGrowth = [...monthly].sort((a, b) => b.revenue_growth - a.revenue_growth);
  const best = sortedByGrowth[0];
  const worst = sortedByGrowth[sortedByGrowth.length - 1];

  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
      <Card
        accent="violet"
        label="총 매출"
        value={formatKRWCompact(overall.revenue_current)}
        sub={`전기 ${formatKRWCompact(overall.revenue_prev)}`}
      />
      <Card
        accent="emerald"
        label="매출 성장률"
        value={
          overall.revenue_growth !== null
            ? `${overall.revenue_growth >= 0 ? "▲" : "▼"} ${Math.abs(overall.revenue_growth).toFixed(1)}%`
            : "—"
        }
        valueClass={(overall.revenue_growth ?? 0) >= 0 ? "text-emerald-700" : "text-rose-600"}
        sub="작년 동기 대비"
      />
      <Card
        accent="sky"
        label="총 매출이익"
        value={formatKRWCompact(overall.profit_current)}
        sub={
          overall.profit_growth !== null
            ? `이익 ${overall.profit_growth >= 0 ? "▲" : "▼"} ${Math.abs(overall.profit_growth).toFixed(1)}%`
            : ""
        }
      />
      <Card
        accent="amber"
        label="최고 성장 월"
        value={best ? `${best.mm}월` : "—"}
        sub={
          best
            ? `▲ ${best.revenue_growth.toFixed(1)}% · 최저 ${worst?.mm}월 ${worst?.revenue_growth >= 0 ? "▲" : "▼"} ${Math.abs(worst?.revenue_growth ?? 0).toFixed(1)}%`
            : ""
        }
      />
    </div>
  );
}

function Card({
  accent, label, value, sub, valueClass = "text-[#0a0a0a]",
}: {
  accent: Accent;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="brutal bg-white p-5">
      <div className={`flex items-center justify-between px-3 py-2 border-[2px] border-[#0a0a0a] ${ACCENT_BG[accent]}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{label}</span>
      </div>
      <p className={`mt-4 font-mono text-[28px] font-extrabold leading-tight tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-[11px] font-medium text-[#0a0a0a]/60 tabular-nums leading-tight">
          {sub}
        </p>
      )}
    </div>
  );
}
