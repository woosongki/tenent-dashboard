"use client";

import { useMemo } from "react";
import type { AttractionRow } from "@/types/attraction";
import { ATTRACTION_BRANCHES } from "@/types/attraction";

interface Props {
  rows: AttractionRow[];
}

export default function BranchProgressGrid({ rows }: Props) {
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
    if (pct === null) return "bg-slate-50 text-slate-300 border-[#f1f5f9]";
    if (pct === 100)  return "bg-violet-600 text-white border-violet-700";
    if (pct >= 70)    return "bg-violet-100 text-violet-700 border-violet-200";
    if (pct >= 40)    return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  return (
    <div className="rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">지점별 입점 진행률</h3>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-300" />0–39%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-300" />40–69%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-300" />70–99%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-600" />완료</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9 md:grid-cols-12">
        {stats.map((s) => (
          <div
            key={s.branch}
            title={`${s.branch}: ${s.done}/${s.total} (${s.pct ?? "—"}%)`}
            className={`flex flex-col items-center justify-center rounded-lg border px-1 py-2 transition-transform hover:scale-105 ${color(s.pct)}`}
          >
            <div className="text-[10px] font-semibold leading-tight truncate max-w-full">{s.branch.replace("점", "")}</div>
            <div className="text-[10px] tabular-nums opacity-80">{s.pct === null ? "—" : `${s.pct}%`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
