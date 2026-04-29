import type { TopBrand } from "@/types/dashboard";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

const RANK_STYLE: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-amber-100",  text: "text-amber-700",  label: "🥇" },
  2: { bg: "bg-gray-100",   text: "text-gray-600",   label: "🥈" },
  3: { bg: "bg-orange-100", text: "text-orange-600", label: "🥉" },
};

interface Props {
  brands: TopBrand[];
}

export default function GrowthRankingTable({ brands }: Props) {
  if (brands.length === 0) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-gray-100 py-12 text-center shadow-sm">
        <p className="text-sm text-gray-400">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
            <th className="px-4 py-3 font-medium text-center w-12">순위</th>
            <th className="px-4 py-3 font-medium text-left">브랜드명</th>
            <th className="px-4 py-3 font-medium text-left">카테고리</th>
            <th className="px-4 py-3 font-medium text-right">매출(현)</th>
            <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">매출(전)</th>
            <th className="px-4 py-3 font-medium text-right">성장률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {brands.map((b) => {
            const style = RANK_STYLE[b.rank];
            const pos = b.revenue_growth >= 0;
            return (
              <tr key={b.rank} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-center">
                  {style ? (
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">{b.rank}위</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{b.brand_name}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {b.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                  {b.revenue_current !== null ? KRW.format(b.revenue_current) : <span className="text-gray-300">—</span>}
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-gray-500 sm:table-cell">
                  {b.revenue_prev !== null ? KRW.format(b.revenue_prev) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
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
