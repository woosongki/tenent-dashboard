/**
 * 매출 성장 순위 — 매출액 성장 Top5 + 성장률 Top5 듀얼 패널.
 * 데이터 소스: data/sales/brand-sales.json (CSV 변환)
 */

import { GROUP_COLOR, shortBrandName, formatKRWCompact } from "@/lib/sales/format";
import type { BrandRecord } from "@/lib/sales/csvData";

interface Props {
  byGrowthAmount: BrandRecord[];
  byGrowth: BrandRecord[];
}

/** 매출 성장액(원): current − prev */
function growthAmount(b: BrandRecord): number {
  const cur = b.summary.revenue_current ?? 0;
  const prev = b.summary.revenue_prev ?? 0;
  return cur - prev;
}

export default function SalesRankingDual({ byGrowthAmount, byGrowth }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <RankingCard
        title="매출액 성장 베스트 5"
        subtitle="전년 동기 대비 증가액 (원)"
        items={byGrowthAmount}
        valueOf={(b) => `+${formatKRWCompact(growthAmount(b))}`}
        valueClass="text-emerald-600"
        // 좌측 카드: 막대 길이는 증가액 기준으로 정규화
        barValueOf={(b) => growthAmount(b)}
        showGrowth
      />
      <RankingCard
        title="매출성장율 베스트 5"
        subtitle="전년 동기 대비 +%"
        items={byGrowth}
        valueOf={(b) =>
          b.summary.revenue_growth !== null
            ? `▲ ${b.summary.revenue_growth.toFixed(1)}%`
            : "—"
        }
        valueClass="text-emerald-600"
        // 우측 카드: 막대 길이는 성장률 기준으로 정규화
        barValueOf={(b) => b.summary.revenue_growth ?? 0}
      />
    </div>
  );
}

function RankingCard({
  title,
  subtitle,
  items,
  valueOf,
  valueClass = "text-slate-900",
  barValueOf,
  showGrowth = false,
}: {
  title: string;
  subtitle: string;
  items: BrandRecord[];
  valueOf: (b: BrandRecord) => string;
  valueClass?: string;
  /** 막대 길이 정규화에 쓸 값 — 카드별로 의미가 달라 외부 주입 */
  barValueOf: (b: BrandRecord) => number;
  showGrowth?: boolean;
}) {
  const maxBar = Math.max(
    ...items.map((b) => Math.abs(barValueOf(b))),
    1,
  );

  return (
    <div className="brutal bg-white">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-slate-400">데이터 없음</p>
      ) : (
        <ol className="space-y-2">
          {items.map((b, i) => {
            const rankLabel = ["🥇", "🥈", "🥉", "4", "5"][i] ?? `${i + 1}`;
            const isMedal = i < 3;
            const c = GROUP_COLOR[b.groupCode] ?? { bg: "bg-slate-50", text: "text-slate-600", hex: "#94a3b8" };
            const barAbs = Math.abs(barValueOf(b));
            const barWidth = Math.max(2, Math.round((barAbs / maxBar) * 100));
            const growth = b.summary.revenue_growth ?? 0;
            const isPositive = growth >= 0;

            return (
              <li
                key={`${b.groupCode}-${b.code}`}
                className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5"
              >
                <span
                  className={`flex h-6 w-7 shrink-0 items-center justify-center rounded-md ${
                    isMedal ? "text-[16px]" : "text-[10px] font-bold text-slate-400 bg-white"
                  }`}
                >
                  {rankLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-semibold text-slate-700">
                      {shortBrandName(b.name, 14)}
                    </span>
                    <span className={`shrink-0 inline-block px-1.5 py-0.5 text-[9px] rounded ${c.bg} ${c.text}`}>
                      {b.groupName}
                    </span>
                  </div>
                  <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barWidth}%`, backgroundColor: c.hex }}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className={`text-[12px] font-bold tabular-nums ${valueClass}`}>
                    {valueOf(b)}
                  </span>
                  {showGrowth && b.summary.revenue_growth !== null && (
                    <span
                      className={`text-[10px] tabular-nums font-medium ${
                        isPositive ? "text-emerald-600" : "text-rose-500"
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
