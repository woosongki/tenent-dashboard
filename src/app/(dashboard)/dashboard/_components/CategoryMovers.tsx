"use client";

import { useState } from "react";
import type { CatMovers, Mover } from "@/lib/dashboard/salesOverview";

const milSigned = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n / 1e6).toLocaleString("ko-KR")}`;

function Growth({ n }: { n: number }) {
  return <span className={`font-mono text-[11px] font-extrabold ${n >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{milSigned(n)}</span>;
}

function BrandLine({ rank, m }: { rank: number; m: Mover }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-5 font-mono text-slate-400">{rank}</span>
      <span className="flex-1 min-w-0 font-bold text-[#0a0a0a] truncate">{m.brand}</span>
      <Growth n={m.growth} />
    </div>
  );
}

export default function CategoryMovers({ catMovers }: { catMovers: CatMovers[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (catMovers.length === 0) {
    return <div className="border-[2px] border-[#0a0a0a] bg-white px-3 py-6 text-center text-[12px] text-slate-400">당월 성장 데이터 없음</div>;
  }

  return (
    <div className="overflow-x-auto border-[2px] border-[#0a0a0a] bg-white">
      <table className="w-full min-w-[460px] text-[12px]">
        <thead className="bg-[#0a0a0a] text-white">
          <tr>
            <th className="px-3 py-2 text-left w-32">카테고리</th>
            <th className="px-3 py-2 text-left">🟢 당월 성장액 1위 (클릭 → TOP 5)</th>
          </tr>
        </thead>
        <tbody>
          {catMovers.map((c) => {
            const isOpen = open === c.category;
            const top = c.brands[0];
            return (
              <tr key={c.category} className="border-t border-slate-100 cursor-pointer hover:bg-yellow-50"
                onClick={() => setOpen(isOpen ? null : c.category)}>
                <td className="px-3 py-2 align-top font-extrabold text-[#0a0a0a] whitespace-nowrap">
                  <span className="mr-1 text-[9px] text-slate-400">{isOpen ? "▼" : "▶"}</span>{c.category}
                </td>
                <td className="px-3 py-2">
                  {!isOpen && (top ? <BrandLine rank={1} m={top} /> : <span className="text-slate-300">—</span>)}
                  {isOpen && (
                    <div className="flex flex-col gap-1.5">
                      {c.brands.map((m, i) => <BrandLine key={m.brand + i} rank={i + 1} m={m} />)}
                      <div className="text-[10px] text-slate-400">성장액 = 당월 올해 − 전년동월 (백만) · 1위 → 최하위 순</div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
