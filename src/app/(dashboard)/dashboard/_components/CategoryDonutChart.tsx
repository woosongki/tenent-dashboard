"use client";

import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import type { CategoryStat } from "@/types/dashboard";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

const CAT_COLORS: Record<string, string> = {
  "팬시/굿즈": "#d946ef",
  "가전":       "#3b82f6",
  "키즈카페":   "#f59e0b",
  "뷰티":       "#f43f5e",
  "스포츠":     "#10b981",
  "빅컨텐츠":   "#8b5cf6",
  "리빙":       "#14b8a6",
  "체험":       "#f97316",
  "기타":       "#94a3b8",
};

function getColor(cat: string) {
  return CAT_COLORS[cat] ?? "#94a3b8";
}

interface Props {
  stats: CategoryStat[];
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: CategoryStat & { pct: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#e8ecf0] bg-white px-3.5 py-2.5 shadow-lg text-[12px]">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: getColor(d.category) }}
        />
        <span className="font-semibold text-slate-800">{d.category}</span>
      </div>
      <div className="space-y-0.5 text-slate-500">
        <p>브랜드 수 <span className="font-semibold text-slate-700">{d.count}개</span></p>
        <p>매출 합계 <span className="font-semibold text-slate-700">{KRW.format(d.revenue)}</span></p>
        <p>비중 <span className="font-semibold text-violet-600">{d.pct.toFixed(1)}%</span></p>
      </div>
    </div>
  );
}

export default function CategoryDonutChart({ stats }: Props) {
  const router = useRouter();
  if (!stats.length) return null;

  const totalRevenue = stats.reduce((s, c) => s + c.revenue, 0);
  const data = stats.map((c) => ({
    ...c,
    pct: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
  }));

  function handleSliceClick() {
    router.push("/dashboard/sales");
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      {/* 상단 accent */}
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-violet-600 via-fuchsia-400 to-rose-400" />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold text-slate-800">카테고리별 매출 분포</p>
          <p className="text-[11px] text-slate-400">브랜드 수 및 매출 기준</p>
        </div>
        <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600">
          전체 {KRW.format(totalRevenue)}
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* 도넛 차트 */}
        <div className="h-[200px] w-full sm:w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="revenue"
                nameKey="category"
                onClick={handleSliceClick}
                className="cursor-pointer"
              >
                {data.map((entry) => (
                  <Cell key={entry.category} fill={getColor(entry.category)} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 범례 + 상세 — 클릭 시 매출분석으로 */}
        <div className="flex flex-1 flex-col gap-1.5">
          {data.map((d) => (
            <button
              key={d.category}
              type="button"
              onClick={() => router.push("/dashboard/sales")}
              className="group flex w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
              title={`${d.category} 매출분석 보기`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: getColor(d.category) }}
              />
              <span className="w-20 text-[12px] font-medium text-slate-600 group-hover:text-violet-700 transition-colors">{d.category}</span>
              <div className="flex-1 h-[5px] overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${d.pct}%`,
                    background: getColor(d.category),
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="w-10 text-right text-[11px] tabular-nums text-slate-400">
                {d.pct.toFixed(1)}%
              </span>
              <span className="w-8 text-right text-[11px] font-semibold tabular-nums text-slate-600">
                {d.count}개
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
