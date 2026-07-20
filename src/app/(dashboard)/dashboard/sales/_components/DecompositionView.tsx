"use client";

import { useState } from "react";
import type { Decomposition, DecompItem } from "@/lib/sales/diagnose";

const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR");
const milSigned = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n / 1e6).toLocaleString("ko-KR")}`;
const pct1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/**
 * 매출증감분해 워터폴 + 클릭 시 TOP5 리스트.
 * 전년 → 신규출점(평수증가 포함) 기여 + 기존점 순증감 + 퇴점 손실 → 당기
 */
export default function DecompositionView({ decomp, subLabel, prevLabel = "전년", curLabel = "당기", defaultOpen = false }: {
  decomp: Decomposition;
  subLabel: string;              // "지점" | "브랜드"
  prevLabel?: string;
  curLabel?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { prevTotal, curTotal, totalChange, newContribution, existChange, closedLoss, newTop5, existTop5 } = decomp;

  // 워터폴 스케일: 전년/당기 중 큰 쪽을 100%로.
  const scaleMax = Math.max(prevTotal, curTotal, 1);
  const pctW = (n: number) => `${Math.max(0, Math.min(100, (n / scaleMax) * 100)).toFixed(2)}%`;

  const yoyPct = prevTotal > 0 ? (totalChange / prevTotal) * 100 : 0;

  return (
    <div className="border border-slate-200 bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[11px] font-extrabold text-[#0a0a0a]">매출증감분해</div>
        <button onClick={() => setOpen((v) => !v)}
          className="border-[2px] border-[#0a0a0a] bg-white px-2 py-0.5 text-[10px] font-bold hover:bg-yellow-100">
          {open ? "TOP5 닫기" : "TOP5 보기"}
        </button>
      </div>

      {/* 워터폴 바 */}
      <div className="space-y-1.5 font-mono text-[11px]">
        <BarRow label={prevLabel} tone="prev" width={pctW(prevTotal)} value={`${mil(prevTotal)} 백만`} />
        {newContribution !== 0 && (
          <BarRow label="+ 신규(평수증가 포함)" tone="new"
            width={pctW(Math.abs(newContribution))} value={`${milSigned(newContribution)} 백만`} />
        )}
        {existChange !== 0 && (
          <BarRow label={`${existChange >= 0 ? "+" : "−"} 기존점`} tone={existChange >= 0 ? "up" : "down"}
            width={pctW(Math.abs(existChange))} value={`${milSigned(existChange)} 백만`} />
        )}
        {closedLoss !== 0 && (
          <BarRow label="− 퇴점" tone="down"
            width={pctW(Math.abs(closedLoss))} value={`${milSigned(closedLoss)} 백만`} />
        )}
        <BarRow label={curLabel} tone="cur" width={pctW(curTotal)} value={`${mil(curTotal)} 백만`}
          suffix={prevTotal > 0 ? ` · 전년비 ${pct1(yoyPct)}` : ""} />
      </div>

      {open && (
        <div className="mt-2.5 grid gap-2 md:grid-cols-2">
          <TopBlock title={`신규출점(평수증가 포함) TOP5`} rows={newTop5} kind="new" subLabel={subLabel} />
          <TopBlock title="기존점 TOP5" rows={existTop5} kind="exist" subLabel={subLabel} />
        </div>
      )}
    </div>
  );
}

function BarRow({ label, tone, width, value, suffix }: {
  label: string;
  tone: "prev" | "cur" | "new" | "up" | "down";
  width: string;
  value: string;
  suffix?: string;
}) {
  const color =
    tone === "prev" ? "bg-slate-300" :
    tone === "cur" ? "bg-[#0a0a0a]" :
    tone === "new" ? "bg-violet-400" :
    tone === "up" ? "bg-emerald-400" : "bg-rose-400";
  const textColor =
    tone === "new" ? "text-violet-700" :
    tone === "up" ? "text-emerald-700" :
    tone === "down" ? "text-rose-700" : "text-slate-700";
  return (
    <div className="flex items-center gap-2">
      <div className={`w-[130px] shrink-0 text-[10px] font-bold ${textColor}`}>{label}</div>
      <div className="relative h-3 flex-1 bg-slate-50">
        <div className={`h-full ${color}`} style={{ width }} />
      </div>
      <div className="w-[140px] shrink-0 text-right tabular-nums text-[10px] text-slate-700">
        {value}{suffix ?? ""}
      </div>
    </div>
  );
}

function TopBlock({ title, rows, kind, subLabel }: {
  title: string; rows: DecompItem[]; kind: "new" | "exist"; subLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-slate-200 p-2">
        <div className="mb-1 text-[10px] font-extrabold text-slate-500">{title}</div>
        <div className="text-[11px] text-slate-400">해당 {subLabel} 없음</div>
      </div>
    );
  }
  return (
    <div className="border border-slate-200 p-2">
      <div className="mb-1 text-[10px] font-extrabold text-[#0a0a0a]">{title}</div>
      <table className="w-full text-[11px]">
        <thead className="text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-1 py-0.5 text-left">{subLabel}</th>
            <th className="px-1 py-0.5 text-right">당기(백만)</th>
            {kind === "new"
              ? <th className="px-1 py-0.5 text-right">구분</th>
              : <th className="px-1 py-0.5 text-right">전년비</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const yoy = r.ps > 0 ? ((r.s - r.ps) / r.ps) * 100 : 0;
            return (
              <tr key={r.key} className="border-b border-slate-50">
                <td className="px-1 py-0.5 font-bold text-[#0a0a0a] whitespace-nowrap">{r.key}</td>
                <td className="px-1 py-0.5 text-right font-mono">{mil(r.s)}</td>
                {kind === "new" ? (
                  <td className="px-1 py-0.5 text-right">
                    {r.reason === "평수증가"
                      ? <span className="text-violet-700">평수증가 +{mil(r.growthS)}</span>
                      : <span className="text-violet-700">신규</span>}
                  </td>
                ) : (
                  <td className={`px-1 py-0.5 text-right font-mono ${yoy >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {pct1(yoy)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
