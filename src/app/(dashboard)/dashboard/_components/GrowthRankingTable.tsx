import type { TopBrand } from "@/types/dashboard";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

const CAT_COLORS: Record<string, string> = {
  "팬시/굿즈": "bg-fuchsia-50 text-fuchsia-700",
  "가전":       "bg-blue-50 text-blue-700",
  "키즈카페":   "bg-yellow-50 text-yellow-700",
  "뷰티":       "bg-rose-50 text-rose-700",
  "스포츠":     "bg-green-50 text-green-700",
  "빅컨텐츠":   "bg-purple-50 text-purple-700",
  "리빙":       "bg-teal-50 text-teal-700",
  "체험":       "bg-orange-50 text-orange-700",
  "기타":       "bg-slate-50 text-slate-600",
};

// ⑥ 스파크라인: prev(회색) vs current(컬러) 미니 바 차트
function SparkBar({
  prev,
  current,
  positive,
}: {
  prev: number | null;
  current: number | null;
  positive: boolean;
}) {
  if (prev === null || current === null) {
    return <span className="text-slate-200 text-[11px]">—</span>;
  }
  const max = Math.max(prev, current, 1);
  const prevH = Math.round((prev / max) * 28);
  const currH = Math.round((current / max) * 28);
  const barColor = positive ? "#10b981" : "#f43f5e";

  return (
    <svg
      width="26"
      height="32"
      viewBox="0 0 26 32"
      aria-label={`이전 ${KRW.format(prev)} → 현재 ${KRW.format(current)}`}
      className="shrink-0"
    >
      {/* 이전 매출 바 (회색) */}
      <rect
        x="0" y={32 - prevH} width="10" height={prevH}
        rx="2" fill="#e2e8f0"
      />
      {/* 현재 매출 바 (컬러) */}
      <rect
        x="14" y={32 - currH} width="10" height={currH}
        rx="2" fill={barColor} opacity={0.85}
      />
    </svg>
  );
}

interface Props {
  brands: TopBrand[];
}

export default function GrowthRankingTable({ brands }: Props) {
  if (brands.length === 0) {
    return (
      <div className="rounded-xl border border-[#e8ecf0] bg-white py-12 text-center shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <p className="text-sm text-slate-400">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[.05em] text-slate-400">
            <th className="px-5 py-3 text-center w-14">순위</th>
            <th className="px-5 py-3 text-left">브랜드명</th>
            <th className="px-5 py-3 text-left">카테고리</th>
            <th className="px-5 py-3 text-right">매출(현)</th>
            <th className="hidden px-5 py-3 text-right sm:table-cell">매출(전)</th>
            {/* ⑥ 스파크라인 열 */}
            <th className="hidden px-4 py-3 text-center sm:table-cell">추이</th>
            <th className="px-5 py-3 text-right">성장률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f8fafc]">
          {brands.map((b) => {
            const pos = b.revenue_growth >= 0;
            const catColor = CAT_COLORS[b.category ?? "기타"] ?? CAT_COLORS["기타"];
            const rankLabel =
              b.rank === 1 ? "🥇" : b.rank === 2 ? "🥈" : b.rank === 3 ? "🥉" : null;

            return (
              <tr
                key={b.rank}
                className="group border-l-[3px] border-l-transparent transition-all hover:border-l-violet-500 hover:bg-[#faf8ff]"
              >
                <td className="px-5 py-3.5 text-center">
                  {rankLabel ? (
                    <span className="text-[18px] leading-none">{rankLabel}</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-slate-300">{b.rank}위</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-700">{b.brand_name}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${catColor}`}>
                    {b.category}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-[12px] text-slate-600">
                  {b.revenue_current !== null ? KRW.format(b.revenue_current) : <span className="text-slate-200">—</span>}
                </td>
                <td className="hidden px-5 py-3.5 text-right tabular-nums text-[12px] text-slate-300 sm:table-cell">
                  {b.revenue_prev !== null ? KRW.format(b.revenue_prev) : <span className="text-slate-200">—</span>}
                </td>
                {/* ⑥ 스파크라인 셀 */}
                <td className="hidden px-4 py-3.5 sm:table-cell">
                  <div className="flex items-end justify-center gap-0.5">
                    <SparkBar prev={b.revenue_prev} current={b.revenue_current} positive={pos} />
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-[12px] font-bold">
                  <span className={pos ? "text-emerald-600" : "text-rose-500"}>
                    {pos ? "▲" : "▼"} {Math.abs(b.revenue_growth).toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
