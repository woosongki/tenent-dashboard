import { GROUP_COLOR, formatKRWCompact } from "@/lib/sales/format";
import type { GroupRecord } from "@/lib/sales/csvData";

interface Props {
  groups: GroupRecord[];
}

export default function GroupComparisonTable({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="brutal bg-white py-10 text-center text-[12px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">
        그룹 데이터 없음
      </div>
    );
  }

  const totalCurrent = groups.reduce((s, g) => s + (g.revenue_current ?? 0), 0);

  return (
    <div className="overflow-x-auto brutal bg-white">
      <table className="w-full text-[13px]">
        <thead className="bg-[#F1ECDB] border-b-[2px] border-[#0a0a0a]">
          <tr>
            <TH align="left">구매그룹</TH>
            <TH align="right">브랜드</TH>
            <TH align="right">올해 매출</TH>
            <TH align="right">작년 매출</TH>
            <TH align="right">성장률</TH>
            <TH align="right">매출이익</TH>
            <TH align="right">이익 성장률</TH>
            <TH align="right">비중</TH>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, idx) => {
            const c = GROUP_COLOR[g.code] ?? { bg: "bg-slate-50", text: "text-slate-600", hex: "#94a3b8" };
            const pct = totalCurrent > 0 ? ((g.revenue_current ?? 0) / totalCurrent) * 100 : 0;
            const isPositive = (g.revenue_growth ?? 0) >= 0;
            const profitPositive = (g.profit_growth ?? 0) >= 0;
            const zebra = idx % 2 === 1 ? "bg-[#FAF7EC]/40" : "bg-white";
            return (
              <tr key={g.code} className={`border-b border-[#0a0a0a]/10 ${zebra} hover:bg-yellow-100`}>
                <td className="px-4 py-3">
                  <span
                    className="inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider text-white"
                    style={{ background: c.hex }}
                  >
                    {g.code}
                  </span>
                  <span className="ml-2 text-[13px] font-extrabold text-[#0a0a0a]">{g.name}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0a0a0a]/65">{g.brandCount}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-extrabold text-[#0a0a0a]">
                  {formatKRWCompact(g.revenue_current)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0a0a0a]/65">
                  {formatKRWCompact(g.revenue_prev)}
                </td>
                <td className={`px-4 py-3 text-right font-mono tabular-nums font-extrabold ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                  {g.revenue_growth !== null ? `${isPositive ? "▲" : "▼"} ${Math.abs(g.revenue_growth).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0a0a0a]">
                  {formatKRWCompact(g.profit_current)}
                </td>
                <td className={`px-4 py-3 text-right font-mono tabular-nums font-extrabold ${profitPositive ? "text-emerald-700" : "text-rose-600"}`}>
                  {g.profit_growth !== null ? `${profitPositive ? "▲" : "▼"} ${Math.abs(g.profit_growth).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 h-2 border-[1.5px] border-[#0a0a0a] bg-white overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: c.hex }} />
                    </div>
                    <span className="font-mono tabular-nums text-[11px] font-extrabold text-[#0a0a0a] w-12 text-right">
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

function TH({
  children, align = "left",
}: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-4 py-3 ${a} text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] whitespace-nowrap`}>
      {children}
    </th>
  );
}
