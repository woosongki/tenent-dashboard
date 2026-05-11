/**
 * 매출 성장 순위 — 매출액 성장 Top5 + 성장률 Top5 듀얼 패널.
 */

import { GROUP_COLOR, shortBrandName, formatKRWCompact } from "@/lib/sales/format";
import type { BrandRecord } from "@/lib/sales/csvData";

interface Props {
  byGrowthAmount: BrandRecord[];
  byGrowth: BrandRecord[];
}

function growthAmount(b: BrandRecord): number {
  const cur = b.summary.revenue_current ?? 0;
  const prev = b.summary.revenue_prev ?? 0;
  return cur - prev;
}

export default function SalesRankingDual({ byGrowthAmount, byGrowth }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <RankingCard
        title="매출액 성장 BEST 5"
        subtitle="전년 동기 대비 증가액 (원)"
        items={byGrowthAmount}
        valueOf={(b) => `+${formatKRWCompact(growthAmount(b))}`}
        barValueOf={(b) => growthAmount(b)}
        showGrowth
      />
      <RankingCard
        title="매출 성장률 BEST 5"
        subtitle="전년 동기 대비 +%"
        items={byGrowth}
        valueOf={(b) =>
          b.summary.revenue_growth !== null
            ? `▲ ${b.summary.revenue_growth.toFixed(1)}%`
            : "—"
        }
        barValueOf={(b) => b.summary.revenue_growth ?? 0}
      />
    </div>
  );
}

function RankingCard({
  title, subtitle, items, valueOf, barValueOf, showGrowth = false,
}: {
  title: string;
  subtitle: string;
  items: BrandRecord[];
  valueOf: (b: BrandRecord) => string;
  barValueOf: (b: BrandRecord) => number;
  showGrowth?: boolean;
}) {
  const maxBar = Math.max(...items.map((b) => Math.abs(barValueOf(b))), 1);

  return (
    <div className="brutal-sm bg-white p-5">
      {/* 라벨 블록 */}
      <div className="mb-4 inline-block border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-3 py-1.5">
        <h3 className="font-display text-[16px] leading-none text-[#0a0a0a]">{title}</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[12px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">
          데이터 없음
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((b, i) => {
            const rankLabel = ["1", "2", "3", "4", "5"][i] ?? `${i + 1}`;
            const rankBg = i === 0 ? "bg-yellow-300" : i === 1 ? "bg-[#F1ECDB]" : i === 2 ? "bg-[#F1ECDB]" : "bg-white";
            const c = GROUP_COLOR[b.groupCode] ?? { bg: "bg-slate-50", text: "text-slate-600", hex: "#94a3b8" };
            const barAbs = Math.abs(barValueOf(b));
            const barWidth = Math.max(2, Math.round((barAbs / maxBar) * 100));
            const growth = b.summary.revenue_growth ?? 0;
            const isPositive = growth >= 0;

            return (
              <li
                key={`${b.groupCode}-${b.code}`}
                className="flex items-center gap-3 border-[2px] border-[#0a0a0a] bg-white px-3 py-2.5"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center border-[2px] border-[#0a0a0a] font-mono font-extrabold text-[12px] tabular-nums text-[#0a0a0a] ${rankBg}`}
                >
                  {rankLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-extrabold text-[#0a0a0a]">
                      {shortBrandName(b.name, 14)}
                    </span>
                    <span
                      className="shrink-0 inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wider text-white"
                      style={{ background: c.hex }}
                    >
                      {b.groupName}
                    </span>
                  </div>
                  <div className="mt-1.5 h-[5px] w-full overflow-hidden border-[1.5px] border-[#0a0a0a] bg-white">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${barWidth}%`, backgroundColor: c.hex }}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="font-mono text-[13px] font-extrabold tabular-nums text-emerald-700">
                    {valueOf(b)}
                  </span>
                  {showGrowth && b.summary.revenue_growth !== null && (
                    <span
                      className={`font-mono text-[10px] tabular-nums font-extrabold ${
                        isPositive ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {isPositive ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}%
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
