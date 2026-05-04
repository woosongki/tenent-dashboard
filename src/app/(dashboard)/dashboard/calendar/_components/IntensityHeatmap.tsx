"use client";

import type { CalendarWeek } from "@/lib/calendar52";

interface Props {
  weeks: CalendarWeek[];
  /** 클릭 시 해당 주차로 스크롤 (옵션) */
  onWeekClick?: (week: CalendarWeek) => void;
}

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/**
 * 12 × 4 히트맵 — 가로 12개월, 세로 4주. 강도 high(rose) / mid(amber) / low(emerald) / unknown(slate).
 * 보고용 한 장 시각화.
 */
export default function IntensityHeatmap({ weeks, onWeekClick }: Props) {
  // (month, weekNo) → week. month는 1..12, weekNo는 1..4
  const lookup = new Map<string, CalendarWeek>();
  for (const w of weeks) {
    const key = `${w.month}|${w.weekNo}`;
    lookup.set(key, w);
  }

  // 통계
  const counts = { high: 0, mid: 0, low: 0 };
  for (const w of weeks) counts[w.intensity] = (counts[w.intensity] ?? 0) + 1;

  return (
    <div className="space-y-3">
      {/* 범례 */}
      <div className="flex items-center gap-4 text-[11px]">
        <Legend color="bg-rose-500"    label="고강도" count={counts.high} />
        <Legend color="bg-amber-400"   label="중강도" count={counts.mid} />
        <Legend color="bg-emerald-500" label="저강도" count={counts.low} />
      </div>

      {/* 히트맵 */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid grid-rows-[auto_repeat(4,minmax(0,1fr))] gap-1.5 min-w-[640px]">
          {/* 컬럼 헤더 (월) */}
          <div className="grid grid-cols-[36px_repeat(12,minmax(0,1fr))] gap-1.5 items-center">
            <span />
            {MONTHS.map((m) => (
              <div key={m} className="text-[10px] font-semibold text-slate-500 text-center">{m}</div>
            ))}
          </div>

          {/* 4주 행 */}
          {[1, 2, 3, 4].map((wkNo) => (
            <div key={wkNo} className="grid grid-cols-[36px_repeat(12,minmax(0,1fr))] gap-1.5 items-center">
              <span className="text-[10px] text-slate-400 text-right pr-1">{wkNo}주</span>
              {MONTHS.map((m) => {
                const w = lookup.get(`${m}|${String(wkNo)}`);
                return (
                  <button
                    key={`${m}-${wkNo}`}
                    type="button"
                    disabled={!w}
                    onClick={() => w && onWeekClick?.(w)}
                    className={`
                      group relative h-9 rounded-md transition-all
                      ${cellCls(w?.intensity)}
                      ${w && onWeekClick ? "hover:ring-2 hover:ring-violet-300 cursor-pointer" : ""}
                    `}
                    title={w ? `${w.month} ${w.weekNo}주 — ${w.concept}` : ""}
                  >
                    {w && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90">
                        {w.grade}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function cellCls(intensity?: "high" | "mid" | "low") {
  switch (intensity) {
    case "high": return "bg-rose-500/85 hover:bg-rose-500";
    case "mid":  return "bg-amber-400/85 hover:bg-amber-400";
    case "low":  return "bg-emerald-500/80 hover:bg-emerald-500";
    default:     return "bg-slate-100 cursor-default";
  }
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} />
      <span className="text-slate-600 font-medium">{label}</span>
      <span className="text-slate-400 tabular-nums">{count}주</span>
    </span>
  );
}
