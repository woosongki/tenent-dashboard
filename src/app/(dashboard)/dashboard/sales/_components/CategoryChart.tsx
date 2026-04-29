"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { BrandPerformanceRow } from "@/types/performance";

interface Props {
  subtotals: BrandPerformanceRow[];
}

type Metric = "revenue" | "gross_profit";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

function formatAxis(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(0)}십억`;
  if (v >= 100_000_000)   return `${(v / 100_000_000).toFixed(0)}억`;
  if (v >= 10_000_000)    return `${(v / 10_000_000).toFixed(0)}천만`;
  return String(v);
}

export default function CategoryChart({ subtotals }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");

  const data = subtotals.map((r) => ({
    name: r.category,
    현기간: metric === "revenue" ? (r.revenue_current ?? 0) : (r.gross_profit_current ?? 0),
    전기간: metric === "revenue" ? (r.revenue_prev    ?? 0) : (r.gross_profit_prev    ?? 0),
  }));

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)] sm:p-5">
      {/* accent */}
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-violet-600 via-indigo-400 to-sky-400" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-slate-800">카테고리별 비교</p>
          <p className="text-[11px] text-slate-400">현기간 vs 전기간</p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[#e8ecf0] text-xs">
          {(["revenue", "gross_profit"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1.5 transition-colors ${
                metric === m
                  ? "bg-violet-600 text-white font-semibold"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {m === "revenue" ? "매출액" : "이익"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[200px] sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatAxis}
              tick={{ fontSize: 10, fill: "#cbd5e1" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              formatter={(v) => [KRW.format(typeof v === "number" ? v : 0)]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 10,
                border: "1px solid #e8ecf0",
                boxShadow: "0 4px 12px rgba(0,0,0,.08)",
              }}
              cursor={{ fill: "#f8fafc" }}
            />
            <Bar dataKey="현기간" fill="#7c3aed" radius={[3, 3, 0, 0]} opacity={0.9} />
            <Bar dataKey="전기간"  fill="#ddd6fe" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center gap-4 justify-end">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#7c3aed]" /> 현기간
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#ddd6fe]" /> 전기간
        </span>
      </div>
    </div>
  );
}
