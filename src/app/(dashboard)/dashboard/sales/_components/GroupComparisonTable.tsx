import { GROUP_COLOR, formatKRWCompact } from "@/lib/sales/format";
import type { GroupRecord } from "@/lib/sales/csvData";

interface Props {
  groups: GroupRecord[];
}

export default function GroupComparisonTable({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className=" border-[2px] border-[#0a0a0a] bg-white py-8 text-center text-[12px] text-slate-400">
        그룹 데이터 없음
      </div>
    );
  }

  const totalCurrent = groups.reduce((s, g) => s + (g.revenue_current ?? 0), 0);

  return (
    <div className="overflow-x-auto brutal bg-white">
      <table className="w-full text-[13px]">
        <thead className="bg-[#F1ECDB] text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">구매그룹</th>
            <th className="px-4 py-2.5 text-right font-medium">브랜드 수</th>
            <th className="px-4 py-2.5 text-right font-medium">올해 매출</th>
            <th className="px-4 py-2.5 text-right font-medium">작년 매출</th>
            <th className="px-4 py-2.5 text-right font-medium">성장률</th>
            <th className="px-4 py-2.5 text-right font-medium">매출이익</th>
            <th className="px-4 py-2.5 text-right font-medium">이익 성장률</th>
            <th className="px-4 py-2.5 text-right font-medium">비중</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f5f9]">
          {groups.map((g) => {
            const c = GROUP_COLOR[g.code] ?? { bg: "bg-slate-50", text: "text-slate-600", hex: "#94a3b8" };
            const pct = totalCurrent > 0 ? ((g.revenue_current ?? 0) / totalCurrent) * 100 : 0;
            const isPositive = (g.revenue_growth ?? 0) >= 0;
            const profitPositive = (g.profit_growth ?? 0) >= 0;
            return (
              <tr key={g.code} className="hover:bg-[#fafaff]">
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded ${c.bg} ${c.text}`}>
                    {g.code}
                  </span>
                  <span className="ml-2 text-[13px] font-semibold text-slate-700">{g.name}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">{g.brandCount}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {formatKRWCompact(g.revenue_current)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                  {formatKRWCompact(g.revenue_prev)}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isPositive ? "text-emerald-600" : "text-rose-500"}`}>
                  {g.revenue_growth !== null ? `${isPositive ? "▲" : "▼"} ${Math.abs(g.revenue_growth).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatKRWCompact(g.profit_current)}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${profitPositive ? "text-emerald-600" : "text-rose-500"}`}>
                  {g.profit_growth !== null ? `${profitPositive ? "▲" : "▼"} ${Math.abs(g.profit_growth).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.hex }} />
                    </div>
                    <span className="tabular-nums text-[11px] text-slate-500 w-10 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
