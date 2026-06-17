"use client";

import { Fragment, useMemo, useState } from "react";
import type { OnlineRank } from "@/lib/sales/queries";

const FragmentRow = Fragment;

interface Props {
  ym: string;          // 당월 'YYYY-MM' 또는 누적 라벨 'YYYY 누적'
  prevYm: string;      // 비교 기간 라벨
  total: number;
  prevTotal: number;
  yoyPct: number;
  brands: OnlineRank[];
  stores: OnlineRank[];
  channels: { channel: string; s: number; ps: number; yoyPct: number }[];
  periodLabel?: string;  // "온라인 매출" 라벨 접두 (기본: 당월)
}

const won = (n: number) => n.toLocaleString("ko-KR");
/** 억 단위 (소수1) */
const eok = (n: number) => (n / 1e8).toFixed(1);
function yoyBadge(pct: number) {
  const up = pct >= 0;
  return (
    <span style={{ color: up ? "#0d9e6e" : "#e53e3e", fontWeight: 700 }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function OnlineMonthTab(p: Props) {
  const [view, setView] = useState<"brand" | "store">("brand");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = view === "brand" ? p.brands : p.stores;
  const filtered = useMemo(
    () => (q ? rows.filter((r) => r.key.includes(q) || (r.cat ?? "").includes(q)) : rows),
    [rows, q],
  );
  // 뷰 전환 시 펼침 초기화
  function switchView(v: "brand" | "store") { setView(v); setExpanded(null); }
  const subLabel = view === "brand" ? "지점" : "브랜드";

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label={`${p.ym} ${p.periodLabel ?? "온라인 매출"}`} value={`${eok(p.total)}억`} sub={`${won(p.total)}원`} accent />
        <SummaryCard label={`전년 (${p.prevYm})`} value={`${eok(p.prevTotal)}억`} sub={`${won(p.prevTotal)}원`} />
        <SummaryCard label="전년대비" value={`${p.yoyPct >= 0 ? "+" : ""}${p.yoyPct}%`}
          sub={`${won(p.total - p.prevTotal)}원`} tone={p.yoyPct >= 0 ? "up" : "down"} />
      </div>

      {/* 채널별 요약 */}
      <div className="border-[2px] border-[#0a0a0a] bg-white">
        <div className="border-b-[2px] border-[#0a0a0a] bg-[#0a0a0a] px-3 py-2 text-[12px] font-bold text-white">
          채널별 매출 ({p.ym})
        </div>
        <div className="divide-y divide-slate-100">
          {p.channels.map((c) => {
            const pctOfTotal = p.total ? (c.s / p.total) * 100 : 0;
            return (
              <div key={c.channel} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                <span className="w-32 shrink-0 font-bold text-[#0a0a0a]">{c.channel}</span>
                <div className="flex-1">
                  <div className="h-3 bg-slate-100">
                    <div className="h-full bg-yellow-400" style={{ width: `${Math.max(pctOfTotal, 0)}%` }} />
                  </div>
                </div>
                <span className="w-12 text-right font-mono text-slate-500">{pctOfTotal.toFixed(1)}%</span>
                <span className="w-24 text-right font-mono font-bold">{won(c.s)}</span>
                <span className="w-20 text-right">{yoyBadge(c.yoyPct)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 브랜드/지점 토글 + 검색 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["brand", "store"] as const).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`border-[2px] border-[#0a0a0a] px-4 py-1.5 text-[12px] font-bold transition ${
                view === v ? "bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-yellow-50"
              }`}
            >
              {v === "brand" ? `브랜드 랭킹 (${p.brands.length})` : `지점별 집계 (${p.stores.length})`}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={view === "brand" ? "브랜드/복종 검색" : "지점 검색"}
          className="border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] focus:outline-none focus:bg-yellow-50"
        />
      </div>

      {/* 랭킹 테이블 */}
      <div className="border-[2px] border-[#0a0a0a] bg-white overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-[#0a0a0a] text-white">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">{view === "brand" ? "브랜드" : "지점"}</th>
              {view === "brand" && <th className="px-3 py-2 text-left">복종</th>}
              <th className="px-3 py-2 text-right">{p.ym} 매출</th>
              <th className="px-3 py-2 text-right">{p.prevYm}</th>
              <th className="px-3 py-2 text-right">전년비</th>
              <th className="px-3 py-2 text-left">주력 채널</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const open = expanded === r.key;
              const colCount = view === "brand" ? 7 : 6;
              return (
                <FragmentRow key={r.key}>
                  <tr
                    className={`border-t border-slate-100 cursor-pointer hover:bg-yellow-50 ${open ? "bg-yellow-50" : ""}`}
                    onClick={() => setExpanded(open ? null : r.key)}
                  >
                    <td className="px-3 py-2 font-mono text-slate-400">
                      <span className="mr-1 inline-block text-[9px] text-slate-400">{open ? "▼" : "▶"}</span>{i + 1}
                    </td>
                    <td className="px-3 py-2 font-bold text-[#0a0a0a]">{r.key}</td>
                    {view === "brand" && <td className="px-3 py-2 text-slate-500">{r.cat}</td>}
                    <td className="px-3 py-2 text-right font-mono font-bold">{won(r.s)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{won(r.ps)}</td>
                    <td className="px-3 py-2 text-right">{yoyBadge(r.yoyPct)}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">
                      {r.byChannel.slice(0, 3).map((c) => `${c.channel} ${eok(c.s)}억`).join(" · ")}
                    </td>
                  </tr>
                  {open && r.bySub && (
                    <tr className="bg-slate-50">
                      <td></td>
                      <td colSpan={colCount - 1} className="px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          {subLabel}별 매출 ({r.bySub.length})
                        </div>
                        <div className="flex flex-col gap-1">
                          {r.bySub.map((s) => {
                            const pct = r.s ? (s.s / r.s) * 100 : 0;
                            return (
                              <div key={s.key} className="flex items-center gap-2 text-[11px]">
                                <span className="w-32 shrink-0 font-bold text-[#0a0a0a]">{s.key}</span>
                                <div className="flex-1 h-2.5 bg-slate-200">
                                  <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-10 text-right font-mono text-slate-400">{pct.toFixed(0)}%</span>
                                <span className="w-24 text-right font-mono font-bold">{won(s.s)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={view === "brand" ? 7 : 6} className="px-3 py-8 text-center text-slate-400">검색 결과 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, tone }: {
  label: string; value: string; sub?: string; accent?: boolean; tone?: "up" | "down";
}) {
  const color = tone === "up" ? "#0d9e6e" : tone === "down" ? "#e53e3e" : "#0a0a0a";
  return (
    <div className={`border-[2px] border-[#0a0a0a] p-3 ${accent ? "bg-yellow-100" : "bg-white"}`}
      style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-[24px] font-extrabold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
