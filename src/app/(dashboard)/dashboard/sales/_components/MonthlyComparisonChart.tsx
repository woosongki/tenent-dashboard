"use client";

import { useMounted } from "@/hooks/useMounted";
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
  const mounted = useMounted();  // SSR/0-size 시 recharts width(-1) 경고 방지

  if (monthly.length === 0) {
    return (
      <div className="brutal bg-white p-6 text-center text-[12px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">
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
    <div className="brutal bg-white p-5">
      <div className="mb-4 inline-block border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-3 py-1.5">
        <h3 className="font-display text-[16px] leading-none text-[#0a0a0a]">월별 매출 비교</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">작년 vs 올해</p>
      </div>

      <div className="h-[280px] w-full min-w-0">
        {mounted && (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#0a0a0a" strokeOpacity={0.08} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#0a0a0a", fontWeight: 700 }}
              axisLine={{ stroke: "#0a0a0a", strokeWidth: 2 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#0a0a0a", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatKRWCompact(v)}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(250, 247, 236, .5)" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12, fontWeight: 700 }}
              formatter={(v) => <span className="uppercase tracking-wider text-[#0a0a0a]">{v}</span>}
            />
            <Bar dataKey="prev" fill="#F1ECDB" stroke="#0a0a0a" strokeWidth={1.5} name="작년" />
            <Bar dataKey="current" fill="#8b5cf6" stroke="#0a0a0a" strokeWidth={1.5} name="올해" />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* 월별 성장률 미니 카드 */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {monthly.map((m) => {
          const isPositive = m.revenue_growth >= 0;
          return (
            <div key={m.mm} className="border-[2px] border-[#0a0a0a] bg-white px-3 py-2 shadow-[2px_2px_0_0_#0a0a0a]">
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65">{m.mm}월 성장률</p>
              <p className={`mt-1 font-mono text-[18px] font-extrabold tabular-nums ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
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
  active, payload, label,
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
    <div className="border-[2px] border-[#0a0a0a] bg-white px-3 py-2 shadow-[3px_3px_0_0_#0a0a0a]">
      <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#0a0a0a] mb-1.5">{label}</p>
      <p className="text-[10px] font-medium text-[#0a0a0a]/70">
        작년 {point.prevYear}: <span className="font-mono tabular-nums font-extrabold text-[#0a0a0a]">{formatKRWCompact(point.prev)}</span>
      </p>
      <p className="text-[10px] font-medium text-[#0a0a0a]/70">
        올해 {point.currentYear}: <span className="font-mono tabular-nums font-extrabold text-[#0a0a0a]">{formatKRWCompact(point.current)}</span>
      </p>
      <p className={`mt-1 font-mono text-[11px] font-extrabold tabular-nums ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
        {isPositive ? "▲" : "▼"} {Math.abs(point.growth).toFixed(1)}%
      </p>
    </div>
  );
}
