"use client";

import { useMemo } from "react";
import type { VendorFnbRow } from "@/types/vendorFnb";
import { VENDOR_STATUSES, STATUS_META } from "@/types/vendorFnb";

interface Props {
  rows: VendorFnbRow[];
}

export default function VendorStatusFunnel({ rows }: Props) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    VENDOR_STATUSES.forEach((s) => { map[s] = 0; });
    rows.forEach((r) => {
      if (r.status && map[r.status] !== undefined) map[r.status]++;
    });
    return map;
  }, [rows]);

  const total = rows.length;
  const max   = Math.max(...VENDOR_STATUSES.map((s) => counts[s]), 1);

  return (
    <div className="rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">상태별 진행 퍼널</h3>
        <span className="text-xs text-slate-400">총 {total}개 업체</span>
      </div>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {VENDOR_STATUSES.map((status) => {
          const cnt = counts[status];
          const pct = (cnt / max) * 100;
          const meta = STATUS_META[status];
          return (
            <div key={status} className="flex min-w-[60px] flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className={`w-full rounded-t transition-all ${meta?.cls.split(" ")[0] ?? "bg-slate-100"} ${cnt > 0 ? "min-h-[4px]" : ""}`}
                  style={{ height: `${pct}%` }}
                  title={`${status}: ${cnt}건`}
                />
              </div>
              <div className="text-[10px] font-bold text-slate-700 tabular-nums">{cnt}</div>
              <div className="text-[9px] text-slate-400 text-center leading-tight whitespace-nowrap">{status}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
