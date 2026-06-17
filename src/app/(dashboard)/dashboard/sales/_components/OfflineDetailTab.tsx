"use client";

import { Fragment, useMemo, useState } from "react";
import type { OffRank } from "@/lib/sales/queries";

interface DivSummary { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface CatSummary { cat: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface Props {
  periodLabel: string;
  prevLabel: string;
  brands: OffRank[];          // division/cat 포함
  divisions: DivSummary[];
  fashionCats: CatSummary[];
}

const won = (n: number) => n.toLocaleString("ko-KR");
const eok = (n: number) => (n / 1e8).toFixed(1);
function YoY({ pct }: { pct: number }) {
  const up = pct >= 0;
  return <span style={{ color: up ? "#0d9e6e" : "#e53e3e", fontWeight: 700 }}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}

type Sel = { type: "cat" | "div"; key: string };

export default function OfflineDetailTab(p: Props) {
  // 선택 칩 목록: 패션 복종 + 비패션 부문(F&B/기타/온라인)
  const fashionChips = p.fashionCats.map((c) => ({ type: "cat" as const, key: c.cat, label: c.cat || "(미분류)", s: c.s }));
  const divChips = p.divisions.filter((d) => d.division !== "패션").map((d) => ({ type: "div" as const, key: d.division, label: d.division, s: d.s }));
  const chips = [...fashionChips, ...divChips];

  const [sel, setSel] = useState<Sel>(chips[0] ? { type: chips[0].type, key: chips[0].key } : { type: "div", key: "패션" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  // 선택 카테고리로 브랜드 필터
  const rows = useMemo(() => {
    const f = p.brands.filter((b) =>
      sel.type === "cat" ? (b.division === "패션" && b.cat === sel.key) : b.division === sel.key);
    return [...f].sort((a, b) => b.s - a.s);
  }, [p.brands, sel]);

  const summary = useMemo(() => {
    const s = rows.reduce((t, r) => t + r.s, 0);
    const ps = rows.reduce((t, r) => t + r.ps, 0);
    const g = rows.reduce((t, r) => t + r.g, 0);
    return { s, ps, g, gpm: s ? +(g / s * 100).toFixed(1) : 0, yoyPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0, brands: rows.length };
  }, [rows]);

  const visible = rows.slice(0, limit);
  const selLabel = chips.find((c) => c.type === sel.type && c.key === sel.key)?.label ?? sel.key;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-500">복종(패션)·부문(F&B 등)을 선택해 상세 실적을 봅니다. 브랜드 클릭 시 지점별 매출이 펼쳐집니다.</p>

      {/* 카테고리 칩 */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const active = sel.type === c.type && sel.key === c.key;
          const isFashion = c.type === "cat";
          return (
            <button key={`${c.type}-${c.key}`} onClick={() => { setSel({ type: c.type, key: c.key }); setExpanded(null); setLimit(20); }}
              className={`border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] font-bold transition ${active ? "text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-slate-50"}`}
              style={active ? { background: isFashion ? "#db2777" : "#7c3aed" } : undefined}>
              {c.label}
              <span className="ml-1.5 font-mono text-[10px] opacity-70">{eok(c.s)}억</span>
            </button>
          );
        })}
      </div>

      {/* 선택 요약 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card label={`${selLabel} 매출`} value={`${eok(summary.s)}억`} sub={`${won(summary.s)}원`} accent />
        <Card label={`전년 (${p.prevLabel})`} value={`${eok(summary.ps)}억`} />
        <Card label="전년대비" value={`${summary.yoyPct >= 0 ? "+" : ""}${summary.yoyPct}%`} tone={summary.yoyPct >= 0 ? "up" : "down"} />
        <Card label="이익률 / 브랜드수" value={`${summary.gpm}%`} sub={`${summary.brands}개 브랜드`} />
      </div>

      {/* 브랜드 랭킹 (지점 드릴다운) */}
      <div className="border-[2px] border-[#0a0a0a] bg-white overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">브랜드</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">매장수</th>
              <th className="px-3 py-2 text-right">매출</th>
              <th className="px-3 py-2 text-right">이익</th>
              <th className="px-3 py-2 text-right">이익률</th>
              <th className="px-3 py-2 text-right">전년비</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const open = expanded === r.key;
              return (
                <Fragment key={r.key}>
                  <tr className={`border-t border-slate-100 cursor-pointer hover:bg-yellow-50 ${open ? "bg-yellow-50" : ""}`} onClick={() => setExpanded(open ? null : r.key)}>
                    <td className="px-3 py-2 font-mono text-slate-400"><span className="mr-1 text-[9px]">{open ? "▼" : "▶"}</span>{i + 1}</td>
                    <td className="px-3 py-2 font-bold text-[#0a0a0a]">{r.key}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{r.subCount}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{won(r.s)}</td>
                    <td className="px-3 py-2 text-right font-mono">{won(r.g)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{r.gpm}%</td>
                    <td className="px-3 py-2 text-right"><YoY pct={r.yoyPct} /></td>
                  </tr>
                  {open && r.bySub && (
                    <tr className="bg-slate-50">
                      <td></td>
                      <td colSpan={6} className="px-3 py-2">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">지점별 매출 ({r.bySub.length})</div>
                        <div className="flex flex-col gap-1">
                          {r.bySub.map((s) => {
                            const pct = r.s ? (s.s / r.s) * 100 : 0;
                            return (
                              <div key={s.key} className="flex items-center gap-2 text-[11px]">
                                <span className="w-28 shrink-0 truncate font-bold text-[#0a0a0a] sm:w-32">{s.key}</span>
                                <div className="flex-1 h-2.5 bg-slate-200"><div className="h-full bg-violet-400" style={{ width: `${pct}%` }} /></div>
                                <span className="w-10 text-right font-mono text-slate-400">{pct.toFixed(0)}%</span>
                                <span className="w-24 text-right font-mono font-bold">{won(s.s)}</span>
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
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">데이터 없음</td></tr>}
          </tbody>
        </table>
        {rows.length > visible.length && (
          <button onClick={() => setLimit((l) => l + 20)}
            className="w-full border-t-[2px] border-[#0a0a0a] bg-yellow-50 py-2.5 text-[12px] font-bold text-[#0a0a0a] hover:bg-yellow-100">
            더 보기 (+20) · {visible.length}/{rows.length}
          </button>
        )}
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
