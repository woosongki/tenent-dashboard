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
// 백만 단위 (상세 브랜드/지점 금액 통일)
const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR");
const milSigned = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n / 1e6).toLocaleString("ko-KR")}`;
function YoY({ pct, prev }: { pct: number; prev?: number }) {
  if (prev !== undefined && prev === 0) {
    return <span style={{ color: "#7c3aed", fontWeight: 700 }} title="전년 동기간 실적 없음 (신규 또는 미집계)">신규</span>;
  }
  const up = pct >= 0;
  return <span style={{ color: up ? "#0d9e6e" : "#e53e3e", fontWeight: 700 }}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}

type Sel = { type: "cat" | "div"; key: string };
type Dir = "asc" | "desc";
type BSortKey = "key" | "subCount" | "s" | "g" | "gpm" | "yoyPct";
type SSortKey = "key" | "s" | "growthS" | "growthPct" | "g" | "growthG" | "growthGPct" | "area" | "dppSales" | "dppGp";
type OffSubLite = import("@/lib/sales/queries").OffSub;

export default function OfflineDetailTab(p: Props) {
  // 선택 칩 목록: 패션 복종 + 비패션 부문(F&B/기타/온라인)
  const fashionChips = p.fashionCats.map((c) => ({ type: "cat" as const, key: c.cat, label: c.cat || "(미분류)", s: c.s }));
  const divChips = p.divisions.filter((d) => d.division !== "패션").map((d) => ({ type: "div" as const, key: d.division, label: d.division, s: d.s }));
  const chips = [...fashionChips, ...divChips];

  const [sel, setSel] = useState<Sel>(chips[0] ? { type: chips[0].type, key: chips[0].key } : { type: "div", key: "패션" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState("");
  // 브랜드 랭킹 정렬
  const [bSort, setBSort] = useState<BSortKey>("s");
  const [bDir, setBDir] = useState<Dir>("desc");
  // 지점 상세 정렬 (펼친 행 공통)
  const [sSort, setSSort] = useState<SSortKey>("s");
  const [sDir, setSDir] = useState<Dir>("desc");

  // 선택 카테고리 브랜드 (요약·칩 기준 — 검색 무관)
  const catRows = useMemo(() =>
    p.brands.filter((b) => sel.type === "cat" ? (b.division === "패션" && b.cat === sel.key) : b.division === sel.key),
  [p.brands, sel]);

  // 표시 행: 검색어 있으면 전 부문에서 브랜드명 검색, 없으면 선택 카테고리. + 정렬
  const rows = useMemo(() => {
    const base = q ? p.brands.filter((b) => b.key.includes(q)) : catRows;
    const dir = bDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) =>
      bSort === "key" ? a.key.localeCompare(b.key, "ko") * dir : ((a[bSort] as number) - (b[bSort] as number)) * dir);
  }, [p.brands, catRows, q, bSort, bDir]);

  function toggleB(k: BSortKey) {
    if (bSort === k) setBDir((d) => d === "asc" ? "desc" : "asc");
    else { setBSort(k); setBDir(k === "key" ? "asc" : "desc"); }
    setExpanded(null); setLimit(20);
  }
  function toggleS(k: SSortKey) {
    if (sSort === k) setSDir((d) => d === "asc" ? "desc" : "asc");
    else { setSSort(k); setSDir(k === "key" ? "asc" : "desc"); }
  }
  const bArrow = (k: BSortKey) => bSort === k ? (bDir === "asc" ? " ▲" : " ▼") : "";
  const sArrow = (k: SSortKey) => sSort === k ? (sDir === "asc" ? " ▲" : " ▼") : "";
  function sortSub(sub: OffSubLite[]) {
    const dir = sDir === "asc" ? 1 : -1;
    return [...sub].sort((a, b) =>
      sSort === "key" ? a.key.localeCompare(b.key, "ko") * dir : ((a[sSort] as number) - (b[sSort] as number)) * dir);
  }

  const summary = useMemo(() => {
    const s = catRows.reduce((t, r) => t + r.s, 0);
    const ps = catRows.reduce((t, r) => t + r.ps, 0);
    const g = catRows.reduce((t, r) => t + r.g, 0);
    // 일평당 = Σ매출 / Σ(평·일). dppSales=매출/평일 이므로 평일=매출/dpp → 역산 합산
    let areaDays = 0;
    for (const r of catRows) if (r.dppSales) areaDays += r.s / r.dppSales;
    return {
      s, ps, g, gpm: s ? +(g / s * 100).toFixed(1) : 0,
      yoyPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0, brands: catRows.length,
      dppSales: areaDays ? Math.round(s / areaDays) : 0,
      dppGp: areaDays ? Math.round(g / areaDays) : 0,
    };
  }, [catRows]);

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

      {/* 브랜드 검색 (입력 시 전 부문에서 탐색) */}
      <div className="flex items-center gap-2">
        <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setExpanded(null); setLimit(20); }}
          placeholder="브랜드 검색 (전 부문)"
          className="w-full max-w-[280px] border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] focus:outline-none focus:bg-yellow-50" />
        {q && <button onClick={() => setQ("")} className="text-[11px] text-slate-500 underline">초기화</button>}
        {q && <span className="text-[11px] text-slate-500">{rows.length}개 검색됨 (요약은 선택 카테고리 기준)</span>}
      </div>

      {/* 선택 요약 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card label={`${selLabel} 매출`} value={`${eok(summary.s)}억`} sub={`${won(summary.s)}원`} accent />
        <Card label={`전년 (${p.prevLabel})`} value={`${eok(summary.ps)}억`} />
        <Card label="전년대비" value={`${summary.yoyPct >= 0 ? "+" : ""}${summary.yoyPct}%`} tone={summary.yoyPct >= 0 ? "up" : "down"} />
        <Card label="이익률 / 브랜드수" value={`${summary.gpm}%`} sub={`${summary.brands}개 브랜드`} />
        <Card label="일평당매출" value={won(summary.dppSales)} sub="원/평·일" />
        <Card label="일평당이익" value={won(summary.dppGp)} sub="원/평·일" />
      </div>

      {/* 브랜드 랭킹 (지점 드릴다운) */}
      <div className="border-[2px] border-[#0a0a0a] bg-white overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white select-none">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:bg-white/10" onClick={() => toggleB("key")}>브랜드{bArrow("key")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("subCount")}>매장수{bArrow("subCount")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleB("s")}>매출(백만){bArrow("s")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleB("g")}>이익(백만){bArrow("g")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleB("gpm")}>이익률{bArrow("gpm")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleB("yoyPct")}>전년비{bArrow("yoyPct")}</th>
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
                    <td className="px-3 py-2 text-right font-mono font-bold">{mil(r.s)}</td>
                    <td className="px-3 py-2 text-right font-mono">{mil(r.g)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{r.gpm}%</td>
                    <td className="px-3 py-2 text-right"><YoY pct={r.yoyPct} prev={r.ps} /></td>
                  </tr>
                  {open && r.bySub && (
                    <tr className="bg-slate-50">
                      <td></td>
                      <td colSpan={6} className="px-3 py-2">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">지점별 상세 ({r.bySub.length})</div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-[11px]">
                            <thead className="text-slate-500 select-none">
                              <tr className="border-b border-slate-200">
                                <th className="px-2 py-1 text-left cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("key")}>지점{sArrow("key")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("s")}>매출(백만){sArrow("s")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("growthS")}>성장액(백만){sArrow("growthS")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("growthPct")}>성장율{sArrow("growthPct")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("g")}>매총익(백만){sArrow("g")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("growthG")}>매총익성장액(백만){sArrow("growthG")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("growthGPct")}>매총익성장율{sArrow("growthGPct")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("area")}>전용면적{sArrow("area")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("dppSales")}>일평당매출{sArrow("dppSales")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("dppGp")}>일평당이익{sArrow("dppGp")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortSub(r.bySub).map((s) => (
                                <tr key={s.key} className="border-b border-slate-100">
                                  <td className="px-2 py-1 font-bold text-[#0a0a0a] whitespace-nowrap">{s.key}</td>
                                  <td className="px-2 py-1 text-right font-mono font-bold">{mil(s.s)}</td>
                                  <td className="px-2 py-1 text-right font-mono" style={{ color: s.ps === 0 ? "#7c3aed" : s.growthS >= 0 ? "#0d9e6e" : "#e53e3e" }}>{s.ps === 0 ? "—" : milSigned(s.growthS)}</td>
                                  <td className="px-2 py-1 text-right"><YoY pct={s.growthPct} prev={s.ps} /></td>
                                  <td className="px-2 py-1 text-right font-mono">{mil(s.g)}</td>
                                  <td className="px-2 py-1 text-right font-mono" style={{ color: s.pg === 0 ? "#7c3aed" : s.growthG >= 0 ? "#0d9e6e" : "#e53e3e" }}>{s.pg === 0 ? "—" : milSigned(s.growthG)}</td>
                                  <td className="px-2 py-1 text-right"><YoY pct={s.growthGPct} prev={s.pg} /></td>
                                  <td className="px-2 py-1 text-right font-mono text-slate-500">{s.area ? `${s.area}평` : "—"}</td>
                                  <td className="px-2 py-1 text-right font-mono text-slate-500">{s.dppSales ? won(s.dppSales) : "—"}</td>
                                  <td className="px-2 py-1 text-right font-mono text-slate-500">{s.dppGp ? won(s.dppGp) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
