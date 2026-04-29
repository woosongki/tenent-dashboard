import { formatKRW, formatPercent } from "@/lib/format";
import type { BrandPerformanceRow } from "@/types/performance";

interface Props {
  summary: BrandPerformanceRow;
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-200">—</span>;
  const pos = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? "text-emerald-600" : "text-rose-500"}`}>
      {pos ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function MetricBlock({
  label, current, prev, growth, accent,
}: {
  label: string;
  current: number | null;
  prev: number | null;
  growth: number | null;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,.04)] sm:px-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] rounded-t-xl ${accent}`} />
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-800 sm:text-xl">
        {current !== null ? formatKRW(current) : "—"}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-xs text-slate-300">
          전기 {prev !== null ? formatKRW(prev) : "—"}
        </span>
        <GrowthBadge value={growth} />
      </div>
    </div>
  );
}

export default function PerformanceCards({ summary }: Props) {
  const grossProfitRate =
    summary.revenue_current && summary.revenue_current > 0 && summary.gross_profit_current
      ? (summary.gross_profit_current / summary.revenue_current) * 100
      : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricBlock
        label="총 매출액"
        current={summary.revenue_current}
        prev={summary.revenue_prev}
        growth={summary.revenue_growth}
        accent="bg-gradient-to-r from-violet-600 to-indigo-400"
      />
      <MetricBlock
        label="매출 총 이익"
        current={summary.gross_profit_current}
        prev={summary.gross_profit_prev}
        growth={summary.gross_profit_growth}
        accent="bg-gradient-to-r from-emerald-500 to-teal-400"
      />
      <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,.04)] sm:px-5">
        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-amber-400 to-orange-300" />
        <p className="text-xs text-slate-400">이익률</p>
        <p className={`mt-2 text-lg font-bold tabular-nums sm:text-xl ${
          grossProfitRate !== null && grossProfitRate >= 15 ? "text-emerald-600" : "text-amber-600"
        }`}>
          {grossProfitRate !== null ? formatPercent(grossProfitRate) : "—"}
        </p>
        <p className="mt-1.5 text-xs text-slate-300">
          기간 {summary.period_current} vs {summary.period_prev}
        </p>
      </div>
    </div>
  );
}
