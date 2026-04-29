"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
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
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800">카테고리별 비교</h2>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {(["revenue", "gross_profit"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1.5 transition-colors ${
                metric === m ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatAxis} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              formatter={(v) => [KRW.format(typeof v === "number" ? v : 0)]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="현기간" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar dataKey="전기간"  fill="#c7d2fe" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
