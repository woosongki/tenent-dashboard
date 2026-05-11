"use client";

import { useRouter } from "next/navigation";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import type { CategoryStat } from "@/types/dashboard";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

const CAT_COLORS: Record<string, string> = {
  // CSV 매출 그룹
  "모던 특정":   "#8b5cf6",
  "가정문화":     "#10b981",
  "테넌트일반":  "#0ea5e9",
  "취미/라이프": "#f59e0b",
  // 기존 brand_performance 카테고리 (호환용)
  "팬시/굿즈":   "#d946ef",
  "가전":         "#3b82f6",
  "키즈카페":     "#f59e0b",
  "뷰티":         "#f43f5e",
  "스포츠":       "#10b981",
  "빅컨텐츠":     "#8b5cf6",
  "리빙":         "#14b8a6",
  "체험":         "#f97316",
  "기타":         "#94a3b8",
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
    <div className="border-[2px] border-[#0a0a0a] bg-white px-3.5 py-2.5 shadow-[3px_3px_0_0_#0a0a0a] text-[12px]">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-block h-2.5 w-2.5 border-[1.5px] border-[#0a0a0a]"
          style={{ background: getColor(d.category) }}
        />
        <span className="font-extrabold uppercase tracking-wider text-[#0a0a0a]">{d.category}</span>
      </div>
      <div className="space-y-0.5 text-[#0a0a0a]/70 font-medium">
        <p>브랜드 <span className="font-mono font-extrabold tabular-nums text-[#0a0a0a]">{d.count}</span></p>
        <p>매출 <span className="font-mono font-extrabold tabular-nums text-[#0a0a0a]">{KRW.format(d.revenue)}</span></p>
        <p>비중 <span className="font-mono font-extrabold tabular-nums text-[#0a0a0a]">{d.pct.toFixed(1)}%</span></p>
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
    <div>
      {/* 상단 요약 칩 */}
      <div className="mb-5 flex items-center justify-end">
        <span className="inline-flex items-center gap-2 border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a]">
          <span>TOTAL</span>
          <span className="font-mono tabular-nums">{KRW.format(totalRevenue)}</span>
        </span>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* 도넛 차트 */}
        <div className="h-[220px] w-full min-w-0 sm:w-[240px] shrink-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                dataKey="revenue"
                nameKey="category"
                onClick={handleSliceClick}
                className="cursor-pointer"
                stroke="#0a0a0a"
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.category} fill={getColor(entry.category)} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 범례 + 진행률 */}
        <div className="flex flex-1 flex-col gap-1.5">
          {data.map((d) => (
            <button
              key={d.category}
              type="button"
              onClick={() => router.push("/dashboard/sales")}
              className="group flex w-full items-center gap-2.5 border-l-[3px] border-transparent px-2 py-1.5 text-left transition-colors hover:border-[#0a0a0a] hover:bg-yellow-100"
              title={`${d.category} 매출분석 보기`}
            >
              <span
                className="h-3 w-3 shrink-0 border-[1.5px] border-[#0a0a0a]"
                style={{ background: getColor(d.category) }}
              />
              <span className="w-24 text-[12px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">
                {d.category}
              </span>
              <div className="flex-1 h-[6px] overflow-hidden border-[1.5px] border-[#0a0a0a] bg-white">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${d.pct}%`,
                    background: getColor(d.category),
                  }}
                />
              </div>
              <span className="w-12 text-right font-mono text-[12px] font-extrabold tabular-nums text-[#0a0a0a]">
                {d.pct.toFixed(1)}%
              </span>
              <span className="w-10 text-right font-mono text-[11px] font-bold tabular-nums text-[#0a0a0a]/60">
                {d.count}개
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
