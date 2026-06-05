"use client";

import { Fragment, useState } from "react";
import { formatKRWCompact, shortBrandName } from "@/lib/sales/format";
import type { StoreRecord } from "@/lib/sales/csvData";

interface Props {
  stores: StoreRecord[];
}

const BRAND_BG: Record<string, string> = {
  "NC백화점": "#5b21b6",
  "뉴코아아울렛": "#0e7490",
  "2001아울렛": "#b45309",
  "동아백화점": "#9d174d",
};

export default function StoreComparisonTable({ stores }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (stores.length === 0) {
    return (
      <div className="brutal bg-white py-10 text-center text-[12px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">
        지점 데이터 없음
      </div>
    );
  }

  const maxRevenue = Math.max(...stores.map((s) => s.revenue_current ?? 0));

  return (
    <div className="overflow-x-auto brutal bg-white">
      <table className="w-full text-[13px]">
        <thead className="bg-[#F1ECDB] border-b-[2px] border-[#0a0a0a]">
          <tr>
            <TH align="left">지점</TH>
            <TH align="right">올해 매출</TH>
            <TH align="right">작년 매출</TH>
            <TH align="right">성장률</TH>
            <TH align="right">매출이익</TH>
            <TH align="right">이익률</TH>
            <TH align="right">브랜드</TH>
            <TH align="center">규모</TH>
          </tr>
        </thead>
        <tbody>
          {stores.map((s, idx) => {
            const isOpen = openId === s.storeId;
            const isPositive = (s.revenue_growth ?? 0) >= 0;
            const marginPct =
              s.revenue_current && s.profit_current
                ? (s.profit_current / s.revenue_current) * 100
                : null;
            const barPct = maxRevenue > 0 ? ((s.revenue_current ?? 0) / maxRevenue) * 100 : 0;
            const zebra = idx % 2 === 1 ? "bg-[#FAF7EC]/40" : "bg-white";
            const badge = BRAND_BG[s.brand] ?? "#475569";

            return (
              <Fragment key={s.storeId}>
                <tr
                  onClick={() => setOpenId(isOpen ? null : s.storeId)}
                  className={`border-b border-[#0a0a0a]/10 ${zebra} hover:bg-yellow-100 cursor-pointer`}
                >
                  <td className="px-4 py-3">
                    <span className="inline-block w-4 text-[10px] text-[#0a0a0a]/40">{isOpen ? "▼" : "▶"}</span>
                    <span
                      className="ml-1 inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wider text-white"
                      style={{ background: badge }}
                    >
                      {s.brand}
                    </span>
                    <span className="ml-2 text-[13px] font-extrabold text-[#0a0a0a]">{s.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-extrabold text-[#0a0a0a]">
                    {formatKRWCompact(s.revenue_current)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0a0a0a]/65">
                    {formatKRWCompact(s.revenue_prev)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums font-extrabold ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                    {s.revenue_growth !== null ? `${isPositive ? "▲" : "▼"} ${Math.abs(s.revenue_growth).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0a0a0a]">
                    {formatKRWCompact(s.profit_current)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0a0a0a]/65">
                    {marginPct !== null ? `${marginPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0a0a0a]/65">{s.brandCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <div className="w-16 h-2 border-[1.5px] border-[#0a0a0a] bg-white overflow-hidden">
                        <div className="h-full bg-[#0a0a0a]" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="bg-[#0a0a0a]/[.03]">
                    <td colSpan={8} className="px-6 py-3">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/55 mb-2">
                        {s.name} 입점 브랜드 매출 TOP {Math.min(10, s.brands.length)}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.brands.slice(0, 10).map((b) => (
                          <span
                            key={b.code}
                            className="inline-flex items-center gap-1.5 border-[1.5px] border-[#0a0a0a] bg-white px-2 py-1 text-[12px] shadow-[1.5px_1.5px_0_0_#0a0a0a]"
                          >
                            <span className="font-bold text-[#0a0a0a]">{shortBrandName(b.name)}</span>
                            <span className="font-mono tabular-nums font-extrabold text-[#0a0a0a]/70">
                              {formatKRWCompact(b.revenue_current)}
                            </span>
                          </span>
                        ))}
                        {s.brands.length === 0 && (
                          <span className="text-[12px] text-[#0a0a0a]/40">입점 브랜드 데이터 없음</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
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
