"use client";

import { useMemo } from "react";
import type { AttractionRow } from "@/types/attraction";
import { ATTRACTION_BRANCHES } from "@/types/attraction";

interface Props {
  rows: AttractionRow[];
  selectedBranch?: string | null;
  onSelectBranch?: (branch: string | null) => void;
}

export default function BranchProgressGrid({
  rows,
  selectedBranch = null,
  onSelectBranch,
}: Props) {
  const stats = useMemo(() => {
    return ATTRACTION_BRANCHES.map((branch) => {
      const items = rows.filter((r) => r.branch === branch);
      const total = items.length;
      const done  = items.filter((r) => r.is_completed).length;
      const pct   = total === 0 ? null : Math.round((done / total) * 100);
      return { branch, total, done, pct };
    });
  }, [rows]);

  function color(pct: number | null) {
    if (pct === null) return "bg-[#F1ECDB] text-[#0a0a0a]/30";
    if (pct === 100)  return "bg-violet-500 text-white";
    if (pct >= 70)    return "bg-emerald-400 text-emerald-950";
    if (pct >= 40)    return "bg-yellow-300 text-[#0a0a0a]";
    return "bg-rose-500 text-white";
  }

  return (
    <div className="brutal bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="inline-block border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-3 py-1.5">
          <h3 className="font-display text-[16px] leading-none text-[#0a0a0a]">지점별 입점 진행률</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
            지점 클릭 시 표 필터링
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/70">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 border-[1.5px] border-[#0a0a0a] bg-rose-500" />0–39%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 border-[1.5px] border-[#0a0a0a] bg-yellow-300" />40–69%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 border-[1.5px] border-[#0a0a0a] bg-emerald-400" />70–99%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 border-[1.5px] border-[#0a0a0a] bg-violet-500" />완료</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 sm:grid-cols-9 md:grid-cols-12">
        {stats.map((s) => {
          const clickable = s.total > 0 && !!onSelectBranch;
          const selected = selectedBranch === s.branch;
          const baseCls = `flex flex-col items-center justify-center border-[2px] border-[#0a0a0a] px-1 py-2.5 transition-all ${color(s.pct)}`;
          const interactCls = clickable
            ? "cursor-pointer hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#0a0a0a]"
            : "cursor-default opacity-90";
          const selectedCls = selected
            ? "shadow-[3px_3px_0_0_#0a0a0a] translate-x-[-1px] translate-y-[-1px]"
            : "";

          const inner = (
            <>
              <div className="text-[10px] font-extrabold uppercase leading-tight truncate max-w-full">{s.branch.replace("점", "")}</div>
              <div className="font-mono text-[11px] font-extrabold tabular-nums">{s.pct === null ? "—" : `${s.pct}%`}</div>
            </>
          );

          if (!clickable) {
            return (
              <div
                key={s.branch}
                title={`${s.branch}: ${s.done}/${s.total} (${s.pct ?? "—"}%)`}
                className={`${baseCls} ${interactCls}`}
              >
                {inner}
              </div>
            );
          }

          return (
            <button
              key={s.branch}
              type="button"
              aria-pressed={selected}
              title={`${s.branch}: ${s.done}/${s.total} (${s.pct ?? "—"}%) — 클릭하면 표 필터${selected ? " 해제" : " 적용"}`}
              onClick={() => onSelectBranch?.(selected ? null : s.branch)}
              className={`${baseCls} ${interactCls} ${selectedCls}`}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
