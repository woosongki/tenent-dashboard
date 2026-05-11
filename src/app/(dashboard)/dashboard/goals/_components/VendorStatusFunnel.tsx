"use client";

import { useMemo } from "react";
import type { VendorFnbRow } from "@/types/vendorFnb";
import { VENDOR_STATUSES, STATUS_META } from "@/types/vendorFnb";

interface Props {
  rows: VendorFnbRow[];
}

type Group = "todo" | "progress" | "done";

const GROUP_META: Record<Group, { label: string; sub: string; bar: string; chip: string }> = {
  todo:     { label: "검토중", sub: "미팅전 · 미팅완료",                  bar: "bg-slate-300",   chip: "text-slate-600" },
  progress: { label: "진행중", sub: "입점제안 · 입점중 · 팝업중",          bar: "bg-blue-400",    chip: "text-blue-700" },
  done:     { label: "완료",   sub: "입점완료 · 확산제안 · 확산완료",       bar: "bg-emerald-400", chip: "text-emerald-700" },
};

export default function VendorStatusFunnel({ rows }: Props) {
  const { groupCounts, statusCounts } = useMemo(() => {
    const g: Record<Group, number> = { todo: 0, progress: 0, done: 0 };
    const s: Record<string, number> = {};
    VENDOR_STATUSES.forEach((st) => { s[st] = 0; });
    rows.forEach((r) => {
      if (!r.status) return;
      const meta = STATUS_META[r.status];
      if (!meta) return;
      g[meta.group]++;
      s[r.status]++;
    });
    return { groupCounts: g, statusCounts: s };
  }, [rows]);

  const total = rows.length;
  const max = Math.max(groupCounts.todo, groupCounts.progress, groupCounts.done, 1);

  return (
    <div className="brutal bg-white">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">진행 단계 퍼널</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">총 {total}개 업체 · 단계 위에 마우스를 올리면 세부 상태 확인</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(GROUP_META) as Group[]).map((g) => {
          const cnt = groupCounts[g];
          const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
          const barH = (cnt / max) * 100;
          const meta = GROUP_META[g];
          const detail = VENDOR_STATUSES
            .filter((st) => STATUS_META[st]?.group === g)
            .map((st) => `${st}: ${statusCounts[st]}건`)
            .join("\n");
          return (
            <div
              key={g}
              className="flex flex-col gap-2"
              title={detail}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <div className={`text-[13px] font-bold ${meta.chip}`}>{meta.label}</div>
                  <div className="text-[10px] text-slate-400">{meta.sub}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-800 tabular-nums leading-none">{cnt}</div>
                  <div className="text-[10px] text-slate-400 tabular-nums">{pct}%</div>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${meta.bar} transition-all`}
                  style={{ width: `${barH}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
