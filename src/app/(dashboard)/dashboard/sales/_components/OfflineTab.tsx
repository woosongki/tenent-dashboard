"use client";

import { Fragment, useMemo, useState } from "react";
import type { OffRank } from "@/lib/sales/queries";

interface DivSummary { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface Props {
  periodLabel: string;     // "2026 누적" / "2026-06"
  prevLabel: string;
  total: number; prevTotal: number; gTotal: number; gpm: number; yoyPct: number;
  brands: OffRank[]; stores: OffRank[]; divisions: DivSummary[];
}

const won = (n: number) => n.toLocaleString("ko-KR");
const eok = (n: number) => (n / 1e8).toFixed(1);
function yoyBadge(pct: number) {
  const up = pct >= 0;
  return <span style={{ color: up ? "#0d9e6e" : "#e53e3e", fontWeight: 700 }}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}
type SortKey = "key" | "s" | "g" | "gpm" | "yoyPct";

export default function OfflineTab(p: Props) {
  const [view, setView] = useState<"brand" | "store">("brand");
  const [q, setQ] = useState("");
  const [div, setDiv] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("s");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const base = view === "brand" ? p.brands : p.stores;
  const filtered = useMemo(() => {
    let list = [...base];
    if (div) list = list.filter((r) => r.division === div || view === "store");
    if (q) list = list.filter((r) => r.key.includes(q) || (r.cat ?? "").includes(q));
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => sortKey === "key" ? a.key.localeCompare(b.key, "ko") * dir : ((a[sortKey] as number) - (b[sortKey] as number)) * dir);
    return list;
  }, [base, q, div, view, sortKey, sortDir]);

  function switchView(v: "brand" | "store") { setView(v); setExpanded(null); }
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "key" ? "asc" : "desc"); }
    setExpanded(null);
  }
  const arrow = (k: SortKey) => sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  const subLabel = view === "brand" ? "지점" : "브랜드";

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <Card label={`${p.periodLabel} 매출`} value={`${eok(p.total)}억`} sub={`${won(p.total)}원`} accent />
        <Card label={`전년 (${p.prevLabel})`} value={`${eok(p.prevTotal)}억`} sub={`${won(p.prevTotal)}원`} />
        <Card label="전년대비" value={`${p.yoyPct >= 0 ? "+" : ""}${p.yoyPct}%`} tone={p.yoyPct >= 0 ? "up" : "down"} />
        <Card label="이익 / 이익률" value={`${eok(p.gTotal)}억`} sub={`GPM ${p.gpm}%`} />
      </div>

      {/* 부문별 요약 */}
      <div className="border-[2px] border-[#0a0a0a] bg-white">
        <div className="border-b-[2px] border-[#0a0a0a] bg-[#0a0a0a] px-3 py-2 text-[12px] font-bold text-white">부문별 매출 ({p.periodLabel})</div>
        <div className="divide-y divide-slate-100">
          {p.divisions.map((d) => {
            const pct = p.total ? (d.s / p.total) * 100 : 0;
            const active = div === d.division;
            return (
              <button key={d.division} onClick={() => setDiv(active ? null : d.division)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-[12px] text-left transition ${active ? "bg-yellow-100" : "hover:bg-slate-50"}`}>
                <span className="w-20 shrink-0 font-bold text-[#0a0a0a]">{d.division}</span>
                <div className="flex-1"><div className="h-3 bg-slate-100"><div className="h-full bg-violet-400" style={{ width: `${pct}%` }} /></div></div>
                <span className="w-10 text-right font-mono text-slate-500">{pct.toFixed(0)}%</span>
                <span className="w-24 text-right font-mono font-bold">{won(d.s)}</span>
                <span className="w-14 text-right font-mono text-slate-500">GPM{d.gpm}</span>
                <span className="w-16 text-right">{yoyBadge(d.yoyPct)}</span>
              </button>
            );
          })}
        </div>
        {div && <div className="bg-yellow-50 px-3 py-1.5 text-[11px] text-slate-600">부문 <b>{div}</b> 필터 적용 중 · <button onClick={() => setDiv(null)} className="underline">전체 보기</button></div>}
      </div>

      {/* 토글 + 검색 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["brand", "store"] as const).map((v) => (
            <button key={v} onClick={() => switchView(v)}
              className={`border-[2px] border-[#0a0a0a] px-4 py-1.5 text-[12px] font-bold transition ${view === v ? "bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-yellow-50"}`}>
              {v === "brand" ? `브랜드 (${p.brands.length})` : `지점 (${p.stores.length})`}
            </button>
          ))}
        </div>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={view === "brand" ? "브랜드/복종 검색" : "지점 검색"}
          className="border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] focus:outline-none focus:bg-yellow-50" />
      </div>

      {/* 랭킹 */}
      <div className="border-[2px] border-[#0a0a0a] bg-white overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-[#0a0a0a] text-white select-none">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:bg-white/10" onClick={() => toggleSort("key")}>{view === "brand" ? "브랜드" : "지점"}{arrow("key")}</th>
              {view === "brand" && <th className="px-3 py-2 text-left">복종</th>}
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("s")}>매출{arrow("s")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("g")}>이익{arrow("g")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("gpm")}>이익률{arrow("gpm")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("yoyPct")}>전년비{arrow("yoyPct")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const open = expanded === r.key;
              const cols = view === "brand" ? 7 : 6;
              return (
                <Fragment key={r.key}>
                  <tr className={`border-t border-slate-100 cursor-pointer hover:bg-yellow-50 ${open ? "bg-yellow-50" : ""}`} onClick={() => setExpanded(open ? null : r.key)}>
                    <td className="px-3 py-2 font-mono text-slate-400"><span className="mr-1 text-[9px]">{open ? "▼" : "▶"}</span>{i + 1}</td>
                    <td className="px-3 py-2 font-bold text-[#0a0a0a]">{r.key}</td>
                    {view === "brand" && <td className="px-3 py-2 text-slate-500">{r.cat}</td>}
                    <td className="px-3 py-2 text-right font-mono font-bold">{won(r.s)}</td>
                    <td className="px-3 py-2 text-right font-mono">{won(r.g)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{r.gpm}%</td>
                    <td className="px-3 py-2 text-right">{yoyBadge(r.yoyPct)}</td>
                  </tr>
                  {open && r.bySub && (
                    <tr className="bg-slate-50">
                      <td></td>
                      <td colSpan={cols - 1} className="px-3 py-2">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{subLabel}별 매출 ({r.bySub.length})</div>
                        <div className="flex flex-col gap-1">
                          {r.bySub.map((s) => {
                            const pct = r.s ? (s.s / r.s) * 100 : 0;
                            return (
                              <div key={s.key} className="flex items-center gap-2 text-[11px]">
                                <span className="w-32 shrink-0 font-bold text-[#0a0a0a]">{s.key}</span>
                                <div className="flex-1 h-2.5 bg-slate-200"><div className="h-full bg-violet-400" style={{ width: `${pct}%` }} /></div>
                                <span className="w-10 text-right font-mono text-slate-400">{pct.toFixed(0)}%</span>
                                <span className="w-24 text-right font-mono font-bold">{won(s.s)}</span>
                                <span className="w-20 text-right font-mono text-slate-500">{won(s.g)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={view === "brand" ? 7 : 6} className="px-3 py-8 text-center text-slate-400">결과 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub, accent, tone }: { label: string; value: string; sub?: string; accent?: boolean; tone?: "up" | "down" }) {
  const color = tone === "up" ? "#0d9e6e" : tone === "down" ? "#e53e3e" : "#0a0a0a";
  return (
    <div className={`border-[2px] border-[#0a0a0a] p-3 ${accent ? "bg-yellow-100" : "bg-white"}`} style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-[22px] font-extrabold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
