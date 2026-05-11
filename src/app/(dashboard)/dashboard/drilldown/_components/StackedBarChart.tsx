"use client";

import { useState, useMemo } from "react";
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
import type { BrandDailyStat } from "@/types/drilldown";
import { formatKRW, formatNumber } from "@/lib/format";

type Metric = "sessions" | "revenue" | "adSpend";

const METRIC_OPTIONS: { key: Metric; label: string; format: (v: number) => string }[] = [
  { key: "sessions", label: "세션",   format: formatNumber },
  { key: "revenue",  label: "매출",   format: formatKRW    },
  { key: "adSpend",  label: "광고비", format: formatKRW    },
];

interface Brand {
  id: string;
  name: string;
  color: string;
}

interface Props {
  data: BrandDailyStat[];
}

function shortDate(d: string) { return d.slice(5); }

export default function StackedBarChart({ data }: Props) {
  const [metric, setMetric] = useState<Metric>("sessions");

  const brands = useMemo<Brand[]>(() => {
    const map = new Map<string, Brand>();
    for (const r of data) {
      if (!map.has(r.brandId))
        map.set(r.brandId, { id: r.brandId, name: r.brandName, color: r.brandColor });
    }
    return [...map.values()];
  }, [data]);

  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();
    for (const r of data) {
      const key = shortDate(r.statDate);
      if (!dateMap.has(key)) dateMap.set(key, { date: key });
      const row = dateMap.get(key)!;
      const prev = typeof row[r.brandId] === "number" ? (row[r.brandId] as number) : 0;
      row[r.brandId] = prev + r[metric];
    }
    return [...dateMap.values()];
  }, [data, metric]);

  const selectedMeta = METRIC_OPTIONS.find((m) => m.key === metric)!;

  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-16 shadow-sm text-center">
        <p className="text-sm text-gray-400">일별 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <p className="text-sm font-medium text-gray-700">브랜드별 일별 누적</p>
        <div className="flex gap-1">
          {METRIC_OPTIONS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={[
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors sm:px-3 sm:py-1",
                metric === m.key
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[180px] w-full min-w-0 sm:h-[220px] lg:h-[260px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={10}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
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
              tickFormatter={(v) => selectedMeta.format(v)}
              width={52}
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
                const brand = brands.find((b) => b.id === name);
                return [selectedMeta.format(v), brand?.name ?? String(name)];
              }}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) => brands.find((b) => b.id === value)?.name ?? value}
            />
            {brands.map((b, i) => (
              <Bar
                key={b.id}
                dataKey={b.id}
                stackId="a"
                fill={b.color}
                radius={i === brands.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
