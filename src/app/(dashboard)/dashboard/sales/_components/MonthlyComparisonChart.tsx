"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { MonthSummary } from "@/lib/sales/csvData";
import { formatKRWCompact } from "@/lib/sales/format";

interface Props {
  monthly: MonthSummary[];
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  payload: ChartPoint;
}

interface ChartPoint {
  label: string;
  prev: number;
  current: number;
  growth: number;
  prevYear: string | null;
  currentYear: string | null;
}

export default function MonthlyComparisonChart({ monthly }: Props) {
  if (monthly.length === 0) {
    return (
      <div className="rounded-xl border border-[#e8ecf0] bg-white p-6 text-center text-[12px] text-slate-400">
        월별 데이터 없음
      </div>
    );
  }

  const data: ChartPoint[] = monthly.map((m) => ({
    label: `${m.mm}월`,
    prev: m.revenue_prev,
    current: m.revenue_current,
    growth: m.revenue_growth,
    prevYear: m.prevYear,
    currentYear: m.currentYear,
  }));

  return (
    <div className="rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <h3 className="text-[14px] font-bold text-slate-800 mb-3">월별 매출 비교 (작년 vs 올해)</h3>
      <div className="h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatKRWCompact(v)}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => <span className="text-slate-600">{v}</span>}
            />
            <Bar dataKey="prev" fill="#cbd5e1" name="작년" radius={[4, 4, 0, 0]} />
            <Bar dataKey="current" fill="#8b5cf6" name="올해" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 월별 성장률 라인 */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {monthly.map((m) => {
          const isPositive = m.revenue_growth >= 0;
          return (
            <div key={m.mm} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[10px] text-slate-500">{m.mm}월 성장률</p>
              <p className={`text-[15px] font-bold tabular-nums ${isPositive ? "text-emerald-600" : "text-rose-500"}`}>
                {isPositive ? "▲" : "▼"} {Math.abs(m.revenue_growth).toFixed(1)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const isPositive = point.growth >= 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-[12px] font-bold text-slate-800 mb-1">{label}</p>
      <p className="text-[10px] text-slate-500">
        작년 {point.prevYear}: <span className="tabular-nums text-slate-700">{formatKRWCompact(point.prev)}</span>
      </p>
      <p className="text-[10px] text-slate-500">
        올해 {point.currentYear}: <span className="tabular-nums text-slate-700">{formatKRWCompact(point.current)}</span>
      </p>
      <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${isPositive ? "text-emerald-600" : "text-rose-500"}`}>
        {isPositive ? "▲" : "▼"} {Math.abs(point.growth).toFixed(1)}%
      </p>
    </div>
  );
}
