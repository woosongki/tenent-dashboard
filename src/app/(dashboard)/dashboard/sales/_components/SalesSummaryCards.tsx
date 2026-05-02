import { formatKRWCompact } from "@/lib/sales/format";
import type { PeriodTotals, MonthSummary } from "@/lib/sales/csvData";

interface Props {
  overall: PeriodTotals | null;
  monthly: MonthSummary[];
}

export default function SalesSummaryCards({ overall, monthly }: Props) {
  if (!overall) return null;

  // 가장 큰 월별 성장 / 가장 작은 월별 성장
  const sortedByGrowth = [...monthly].sort((a, b) => b.revenue_growth - a.revenue_growth);
  const best = sortedByGrowth[0];
  const worst = sortedByGrowth[sortedByGrowth.length - 1];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        accent="violet"
        label="총 매출 (현재)"
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
        valueClass={(overall.revenue_growth ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"}
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

const ACCENT: Record<string, string> = {
  violet:  "from-violet-500 to-violet-300",
  emerald: "from-emerald-500 to-emerald-300",
  sky:     "from-sky-500 to-sky-300",
  amber:   "from-amber-500 to-amber-300",
};

function Card({
  accent,
  label,
  value,
  sub,
  valueClass = "text-slate-900",
}: {
  accent: keyof typeof ACCENT;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className={`absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r ${ACCENT[accent]}`} />
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-[20px] font-extrabold leading-tight tabular-nums ${valueClass}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] text-slate-400 tabular-nums">{sub}</p>}
    </div>
  );
}
