import { formatKRW, formatNumber, formatPercent, formatRoas } from "@/lib/format";

interface Metric {
  label: string;
  value: string;
}

interface Props {
  sessions: number;
  conversions: number;
  revenue: number;
  adSpend: number;
  conversionRate: number;
  roas: number | null;
  cpa: number | null;
}

export default function MetricCards({
  sessions,
  conversions,
  revenue,
  adSpend,
  conversionRate,
  roas,
  cpa,
}: Props) {
  const metrics: Metric[] = [
    { label: "세션",    value: formatNumber(sessions) },
    { label: "전환",    value: formatNumber(conversions) },
    { label: "전환율",  value: formatPercent(conversionRate) },
    { label: "매출",    value: formatKRW(revenue) },
    { label: "광고비",  value: formatKRW(adSpend) },
    { label: "ROAS",    value: roas !== null ? formatRoas(roas) : "–" },
    { label: "CPA",     value: cpa  !== null ? formatKRW(cpa)   : "–" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
          <p className="text-xs text-gray-500">{m.label}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 leading-tight sm:text-base lg:text-lg tabular-nums">
            {m.value}
          </p>
        </div>
      ))}
    </div>
  );
}
