"use client";

import { useMemo } from "react";
import type { MarketPriceRow } from "@/types/marketPrice";
import { MARKET_PRICE_TRENDS, MARKET_BRANDS, TREND_META } from "@/types/marketPrice";

interface Props {
  rows: MarketPriceRow[];
}

export default function MarketPriceCharts({ rows }: Props) {
  // 1) 지수추세 분포
  const trendDist = useMemo(() => {
    const map: Record<string, number> = {};
    MARKET_PRICE_TRENDS.forEach((t) => { map[t] = 0; });
    rows.forEach((r) => { if (r.price_trend && map[r.price_trend] !== undefined) map[r.price_trend]++; });
    return map;
  }, [rows]);

  // 2) 브랜드별 평균 월세 — numeric 컬럼 직접 사용 (텍스트 파싱 불필요)
  const brandAvg = useMemo(() => {
    return MARKET_BRANDS.map((brand) => {
      const items = rows.filter((r) => r.brand === brand);
      const values = items.map((r) => r.monthly_rent_num).filter((v): v is number => v !== null);
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      return { brand, avg, count: items.length };
    });
  }, [rows]);

  const maxAvg = Math.max(...brandAvg.map((b) => b.avg), 1);
  const totalTrend = MARKET_PRICE_TRENDS.reduce((sum, t) => sum + trendDist[t], 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 지수추세 */}
      <div className="rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">지수추세 분포</h3>
          <span className="text-xs text-slate-400">총 {totalTrend}건</span>
        </div>
        <div className="space-y-3">
          {MARKET_PRICE_TRENDS.map((t) => {
            const cnt = trendDist[t];
            const pct = totalTrend ? (cnt / totalTrend) * 100 : 0;
            const meta = TREND_META[t];
            return (
              <div key={t} className="flex items-center gap-3">
                <span className={`w-12 text-xs font-bold ${meta?.cls}`}>
                  {meta?.icon} {meta?.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      t === "상승" ? "bg-emerald-500" : t === "보합" ? "bg-slate-400" : "bg-rose-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right text-xs font-semibold tabular-nums text-slate-600">{cnt}건 ({pct.toFixed(0)}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 브랜드별 평균 월세 */}
      <div className="rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">브랜드별 평균 월세 (만원)</h3>
          <span className="text-[10px] text-slate-400">월세 중앙값 기반</span>
        </div>
        <div className="space-y-3">
          {brandAvg.map((b) => {
            const pct = (b.avg / maxAvg) * 100;
            return (
              <div key={b.brand} className="flex items-center gap-3">
                <span className="w-20 text-xs font-medium text-slate-600 truncate">{b.brand}</span>
                <div className="flex-1 h-6 rounded-md bg-slate-50 overflow-hidden">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-violet-500 to-violet-400 flex items-center justify-end px-2 transition-all"
                    style={{ width: b.avg ? `${pct}%` : "0%" }}
                  >
                    {b.avg > 0 && (
                      <span className="text-[10px] font-bold text-white">{b.avg.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <span className="w-12 text-right text-[10px] text-slate-400">{b.count}건</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
