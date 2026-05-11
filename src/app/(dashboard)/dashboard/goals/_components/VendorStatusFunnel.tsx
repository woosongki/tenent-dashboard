"use client";

import { useMemo } from "react";
import type { VendorFnbRow } from "@/types/vendorFnb";
import { VENDOR_STATUSES, STATUS_META } from "@/types/vendorFnb";

interface Props {
  rows: VendorFnbRow[];
}

type Group = "todo" | "progress" | "done";

const GROUP_META: Record<Group, { label: string; sub: string; bar: string }> = {
  todo:     { label: "검토중", sub: "미팅전 · 미팅완료",                  bar: "bg-[#F1ECDB]" },
  progress: { label: "진행중", sub: "입점제안 · 입점중 · 팝업중",          bar: "bg-cyan-400" },
  done:     { label: "완료",   sub: "입점완료 · 확산제안 · 확산완료",       bar: "bg-emerald-400" },
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
    <div className="brutal bg-white p-5">
      <div className="mb-4 inline-block border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-3 py-1.5">
        <h3 className="font-display text-[16px] leading-none text-[#0a0a0a]">진행 단계 퍼널</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
          총 <span className="font-mono">{total}</span>개 업체 · 위에 호버하면 세부 상태
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(GROUP_META) as Group[]).map((g) => {
          const cnt = groupCounts[g];
          const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
          const barW = (cnt / max) * 100;
          const meta = GROUP_META[g];
          const detail = VENDOR_STATUSES
            .filter((st) => STATUS_META[st]?.group === g)
            .map((st) => `${st}: ${statusCounts[st]}건`)
            .join("\n");
          return (
            <div
              key={g}
              className="border-[2px] border-[#0a0a0a] bg-white px-4 py-3 shadow-[2px_2px_0_0_#0a0a0a]"
              title={detail}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-[12px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]">{meta.label}</div>
                  <div className="mt-0.5 text-[10px] font-medium text-[#0a0a0a]/55">{meta.sub}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[28px] font-extrabold tabular-nums leading-none text-[#0a0a0a]">{cnt}</div>
                  <div className="font-mono text-[10px] font-bold tabular-nums text-[#0a0a0a]/55">{pct}%</div>
                </div>
              </div>
              <div className="mt-3 h-2 w-full border-[1.5px] border-[#0a0a0a] bg-white overflow-hidden">
                <div
                  className={`h-full ${meta.bar} transition-all`}
                  style={{ width: `${barW}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
