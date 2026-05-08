"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { DailyStat } from "@/types/drilldown";
import { formatKRW, formatNumber, formatPercent } from "@/lib/format";

type Metric = "sessions" | "conversions" | "revenue" | "adSpend" | "conversionRate";

const METRICS: { key: Metric; label: string; color: string; format: (v: number) => string }[] = [
  { key: "sessions",       label: "세션",   color: "#6366f1", format: formatNumber  },
  { key: "conversions",    label: "전환",   color: "#10b981", format: formatNumber  },
  { key: "revenue",        label: "매출",   color: "#f59e0b", format: formatKRW     },
  { key: "adSpend",        label: "광고비", color: "#ef4444", format: formatKRW     },
  { key: "conversionRate", label: "전환율", color: "#8b5cf6", format: formatPercent },
];

interface Props {
  data: DailyStat[];
  brandColor: string;
}

function shortDate(d: string) { return d.slice(5); }

export default function DailyLineChart({ data }: Props) {
  const [active, setActive] = useState<Metric[]>(["sessions", "conversions"]);

  const chartData = data.map((r) => ({
    date:           shortDate(r.statDate),
    sessions:       r.sessions,
    conversions:    r.conversions,
    revenue:        r.revenue,
    adSpend:        r.adSpend,
    conversionRate: r.conversionRate,
  }));

  function toggle(key: Metric) {
    setActive((prev) =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter((k) => k !== key) : prev
        : [...prev, key],
    );
  }

  const formatYAxis = (v: number) => {
    if (active.every((k) => k === "revenue" || k === "adSpend")) return formatKRW(v);
    if (active.every((k) => k === "conversionRate")) return `${v}%`;
    return formatNumber(v);
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
        <p className="text-sm font-medium text-gray-700">일별 추이</p>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              className={[
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors sm:px-3 sm:py-1",
                active.includes(m.key)
                  ? "border-transparent text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300",
              ].join(" ")}
              style={active.includes(m.key) ? { backgroundColor: m.color, borderColor: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 반응형 높이: 모바일 180px → 태블릿 220px → 데스크탑 260px */}
      <div className="h-[180px] w-full min-w-0 sm:h-[220px] lg:h-[260px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              width={48}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : 0;
                const m = METRICS.find((x) => x.key === name);
                return [m ? m.format(v) : v, m?.label ?? String(name)];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) => METRICS.find((m) => m.key === value)?.label ?? value}
            />
            {METRICS.filter((m) => active.includes(m.key)).map((m) => (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
