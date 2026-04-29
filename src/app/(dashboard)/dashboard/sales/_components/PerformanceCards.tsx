import { formatKRW, formatPercent } from "@/lib/format";
import type { BrandPerformanceRow } from "@/types/performance";

interface Props {
  summary: BrandPerformanceRow;
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300">—</span>;
  const pos = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? "text-emerald-600" : "text-rose-500"}`}>
      {pos ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function MetricBlock({
  label, current, prev, growth,
}: {
  label: string;
  current: number | null;
  prev: number | null;
  growth: number | null;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm sm:px-5">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">
        {current !== null ? formatKRW(current) : "—"}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-gray-400">
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
      />
      <MetricBlock
        label="매출 총 이익"
        current={summary.gross_profit_current}
        prev={summary.gross_profit_prev}
        growth={summary.gross_profit_growth}
      />
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm sm:px-5">
        <p className="text-xs text-gray-400">이익률</p>
        <p className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${
          grossProfitRate !== null && grossProfitRate >= 15 ? "text-emerald-600" : "text-amber-600"
        }`}>
          {grossProfitRate !== null ? formatPercent(grossProfitRate) : "—"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          기간 {summary.period_current} vs {summary.period_prev}
        </p>
      </div>
    </div>
  );
}
