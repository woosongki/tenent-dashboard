"use client";

import { useState } from "react";
import type { CatMovers, Mover } from "@/lib/dashboard/salesOverview";

const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR");

function BrandLine({ rank, m }: { rank: number; m: Mover }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-5 font-mono text-slate-400">{rank}</span>
      <span className="flex-1 min-w-0 font-bold text-[#0a0a0a] truncate">{m.brand}</span>
      <span className="font-mono text-[11px] font-extrabold text-[#0a0a0a]">{mil(m.s)}</span>
    </div>
  );
}

/** side="top": 매출 상위(내림차순) · side="bottom": 매출 최하위(오름차순) */
function Panel({ catMovers, side }: { catMovers: CatMovers[]; side: "top" | "bottom" }) {
  const [open, setOpen] = useState<string | null>(null);
  const headBg = side === "top" ? "bg-emerald-500" : "bg-rose-500";
  const headText = side === "top" ? "매출 TOP 5" : "매출 최하위 5";
  const hint = side === "top" ? "매출 1위 · 클릭 → TOP 5" : "최하위 1위 · 클릭 → 최하위 순 5";

  return (
    <div className="overflow-x-auto border-[2px] border-[#0a0a0a] bg-white">
      <table className="w-full min-w-[300px] text-[12px]">
        <thead>
          <tr className={`${headBg} text-white`}>
            <th className="px-3 py-2 text-left w-28">카테고리</th>
            <th className="px-3 py-2 text-left">{headText} <span className="font-normal opacity-80">· 백만</span></th>
          </tr>
        </thead>
        <tbody>
          {catMovers.map((c) => {
            const isOpen = open === c.category;
            const five = side === "top" ? c.brands.slice(0, 5) : c.brands.slice(-5).reverse();
            const lead = five[0];
            return (
              <tr key={c.category} className="border-t border-slate-100 cursor-pointer hover:bg-yellow-50"
                onClick={() => setOpen(isOpen ? null : c.category)}>
                <td className="px-3 py-2 align-top font-extrabold text-[#0a0a0a] whitespace-nowrap">
                  <span className="mr-1 text-[9px] text-slate-400">{isOpen ? "▼" : "▶"}</span>{c.category}
                </td>
                <td className="px-3 py-2">
                  {!isOpen && (lead ? <BrandLine rank={1} m={lead} /> : <span className="text-slate-300">—</span>)}
                  {isOpen && (
                    <div className="flex flex-col gap-1.5">
                      {five.map((m, i) => <BrandLine key={m.brand + i} rank={i + 1} m={m} />)}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {catMovers.length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-slate-400">당월 데이터 없음</td></tr>}
        </tbody>
      </table>
      <div className="border-t border-slate-200 px-3 py-1.5 text-[10px] text-slate-400">{hint}</div>
    </div>
  );
}

export default function CategoryMovers({ catMovers }: { catMovers: CatMovers[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel catMovers={catMovers} side="top" />
      <Panel catMovers={catMovers} side="bottom" />
    </div>
  );
}
