"use client";

import { useMemo, useState } from "react";
import type { BcdBrand } from "@/lib/sales/queries";
import { displayDivision, isHiddenCat, displayCat, catRank, divisionRank } from "@/lib/sales/labels";
import { pillBtn, inputCompact } from "@/lib/tokens";
import ScrollHint from "@/components/ui/ScrollHint";
import UnitChip from "@/components/ui/UnitChip";

interface DivSummary { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface CatSummary { cat: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
export interface BcdData {
  periodLabel: string; prevLabel: string;
  total: number; prevTotal: number; gTotal: number; gpm: number; yoyPct: number;
  divisions: DivSummary[]; fashionCats: CatSummary[];
  brands: BcdBrand[];
  bcdScore: number; bcdScorePrev: number; bcdDiff: number;
  abStores: number; totalStores: number; unmatched: number;
}

const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR");
const eok = (n: number) => (n / 1e8).toFixed(1);

const GRADES = ["S", "A", "B", "C", "F", ""] as const;
const GRADE_STYLE: Record<string, { bar: string; chip: string; label: string }> = {
  S: { bar: "#7c3aed", chip: "bg-violet-100 text-violet-800 border-violet-300", label: "S" },
  A: { bar: "#0d9e6e", chip: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "A" },
  B: { bar: "#2b6cb0", chip: "bg-sky-100 text-sky-800 border-sky-300", label: "B" },
  C: { bar: "#b7791f", chip: "bg-amber-100 text-amber-800 border-amber-300", label: "C" },
  F: { bar: "#e53e3e", chip: "bg-rose-100 text-rose-800 border-rose-300", label: "F" },
  "": { bar: "#94a3b8", chip: "bg-slate-100 text-slate-600 border-slate-300", label: "미분류" },
};

function GradeBadge({ g }: { g: string }) {
  const s = GRADE_STYLE[g] ?? GRADE_STYLE[""];
  return <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-extrabold ${s.chip}`}>{s.label}</span>;
}
function Yo({ pct, prev }: { pct: number; prev?: number }) {
  if (prev !== undefined && prev === 0) return <span className="font-bold text-violet-600">신규</span>;
  const up = pct >= 0;
  return <span className="whitespace-nowrap tabular-nums font-bold" style={{ color: up ? "#0d9e6e" : "#e53e3e" }}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}

export default function BcdClient({ cum, month }: { cum: BcdData | null; month: BcdData | null }) {
  const [period, setPeriod] = useState<"cum" | "month">("cum");
  const d = period === "cum" ? cum : month;

  if (!cum && !month) {
    return <div className="border-[2px] border-dashed border-slate-300 p-10 text-center text-[13px] text-slate-400">BCD 데이터가 없습니다. 매출 데이터와 brand_grade 적재를 확인하세요.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setPeriod("cum")} className={pillBtn(period === "cum")} disabled={!cum}>누적{cum ? ` · ${cum.periodLabel}` : ""}</button>
        <button onClick={() => setPeriod("month")} className={pillBtn(period === "month")} disabled={!month}>당월{month ? ` · ${month.periodLabel}` : ""}</button>
        <span className="ml-1"><UnitChip>매출 단위: 백만원</UnitChip></span>
      </div>
      {d ? <BcdView d={d} /> : <div className="text-[13px] text-slate-400">해당 기간 데이터 없음</div>}
    </div>
  );
}

type Sel = { type: "cat" | "div"; key: string } | null;

function BcdView({ d }: { d: BcdData }) {
  const [sel, setSel] = useState<Sel>(null);
  const [view, setView] = useState<"brand" | "store">("brand");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(20);

  const chips = useMemo(() => {
    const f = d.fashionCats.filter((c) => !isHiddenCat(c.cat)).sort((a, b) => catRank(a.cat) - catRank(b.cat))
      .map((c) => ({ type: "cat" as const, key: c.cat, label: displayCat(c.cat) || "(미분류)" }));
    const dv = d.divisions.filter((x) => x.division !== "패션").sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
      .map((x) => ({ type: "div" as const, key: x.division, label: displayDivision(x.division) }));
    return [...f, ...dv];
  }, [d]);

  const brands = useMemo(() => {
    if (!sel) return d.brands;
    return d.brands.filter((b) => sel.type === "cat" ? (b.division === "패션" && b.cat === sel.key) : b.division === sel.key);
  }, [d.brands, sel]);

  // 등급별 집계 + BCD점수 (필터된 집합 기준)
  const agg = useMemo(() => {
    const m = new Map<string, { grade: string; brCnt: number; stCnt: number; prevStCnt: number; s: number; ps: number; g: number }>();
    for (const b of brands) {
      const e = m.get(b.grade) ?? { grade: b.grade, brCnt: 0, stCnt: 0, prevStCnt: 0, s: 0, ps: 0, g: 0 };
      e.brCnt++; e.stCnt += b.subCount; e.prevStCnt += b.prevStores; e.s += b.s; e.ps += b.ps; e.g += b.g;
      m.set(b.grade, e);
    }
    const rows = [...m.values()].sort((a, b) => GRADES.indexOf(a.grade as typeof GRADES[number]) - GRADES.indexOf(b.grade as typeof GRADES[number]));
    const totalS = rows.reduce((t, r) => t + r.s, 0);
    const totalSt = rows.reduce((t, r) => t + r.stCnt, 0);
    const prevSt = rows.reduce((t, r) => t + r.prevStCnt, 0);
    const ab = rows.filter((r) => r.grade === "A" || r.grade === "B");
    const abSt = ab.reduce((t, r) => t + r.stCnt, 0);
    const abPrevSt = ab.reduce((t, r) => t + r.prevStCnt, 0);
    const score = totalSt ? abSt / totalSt * 100 : 0;
    const scorePrev = prevSt ? abPrevSt / prevSt * 100 : 0;
    return { rows, totalS, totalSt, abSt, score, scorePrev, diff: score - scorePrev, unmatched: brands.filter((b) => !b.grade).length };
  }, [brands]);

  // 지점별 — 각 지점의 등급 슬롯으로 BCD점수
  const storeRows = useMemo(() => {
    const m = new Map<string, { store: string; total: number; ab: number; s: number }>();
    for (const b of brands) for (const sub of b.bySub ?? []) {
      if (!(sub.s > 0)) continue;
      const e = m.get(sub.key) ?? { store: sub.key, total: 0, ab: 0, s: 0 };
      e.total++; e.s += sub.s; if (b.grade === "A" || b.grade === "B") e.ab++;
      m.set(sub.key, e);
    }
    let rows = [...m.values()].map((e) => ({ ...e, bcd: e.total ? e.ab / e.total * 100 : 0 }));
    if (q) rows = rows.filter((r) => r.store.includes(q));
    return rows.sort((a, b) => b.bcd - a.bcd || b.s - a.s);
  }, [brands, q]);

  const brandRows = useMemo(() => {
    let rows = brands;
    if (q) rows = rows.filter((b) => b.key.includes(q) || displayCat(b.cat).includes(q));
    return [...rows].sort((a, b) => b.s - a.s);
  }, [brands, q]);

  const visible = brandRows.slice(0, limit);

  return (
    <div className="space-y-4">
      {/* BCD 점수 + 요약 카드 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <div className="border-[2px] border-[#0a0a0a] bg-yellow-100 p-3" style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
          <div className="text-[11px] font-bold text-slate-500">BCD점수 (A+B매장 비율)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] font-extrabold leading-none">{agg.score.toFixed(1)}</span><span className="text-[13px] font-bold">점</span>
            <span className="ml-1 text-[12px] font-bold" style={{ color: agg.diff >= 0 ? "#0d9e6e" : "#e53e3e" }}>{agg.diff >= 0 ? "▲" : "▼"}{Math.abs(agg.diff).toFixed(1)}</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">전년 {agg.scorePrev.toFixed(1)}점</div>
        </div>
        <Card label="A+B 매장 / 전체" value={`${agg.abSt.toLocaleString()} / ${agg.totalSt.toLocaleString()}`} sub="개 매장" />
        <Card label={`${d.periodLabel} 매출`} value={`${eok(agg.totalS)}억`} sub={`${mil(agg.totalS)}백만`} />
        <Card label="미분류 브랜드" value={`${agg.unmatched.toLocaleString()}`} sub={agg.unmatched ? "등급 미매칭 — 표기 확인" : "전부 매칭됨"} tone={agg.unmatched ? "warn" : undefined} />
      </div>

      {/* 카테고리 칩 */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => { setSel(null); setLimit(20); }} className={`border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] font-bold transition ${!sel ? "bg-[#0a0a0a] text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-slate-50"}`}>전체</button>
        {chips.map((c) => {
          const active = sel?.type === c.type && sel?.key === c.key;
          return (
            <button key={`${c.type}-${c.key}`} onClick={() => { setSel({ type: c.type, key: c.key }); setLimit(20); }}
              className={`border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] font-bold transition ${active ? "text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-slate-50"}`}
              style={active ? { background: c.type === "cat" ? "#db2777" : "#7c3aed" } : undefined}>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* 등급별 요약 */}
      <div className="border-[2px] border-[#0a0a0a] bg-white">
        <div className="border-b-[2px] border-[#0a0a0a] bg-[#0a0a0a] px-3 py-2 text-[12px] font-bold text-white">등급별 요약 (백만 · {d.periodLabel})</div>
        <div className="divide-y divide-slate-100">
          {agg.rows.map((r) => {
            const pct = agg.totalS ? r.s / agg.totalS * 100 : 0;
            const st = GRADE_STYLE[r.grade] ?? GRADE_STYLE[""];
            const yoy = r.ps ? (r.s - r.ps) / r.ps * 100 : 0;
            return (
              <div key={r.grade} className="flex items-center gap-2 px-3 py-2 text-[11px] sm:gap-3 sm:text-[12px]">
                <span className="w-12 shrink-0"><GradeBadge g={r.grade} /></span>
                <span className="hidden w-20 shrink-0 text-right font-mono text-slate-500 sm:inline">{r.brCnt}개 · {r.stCnt}점</span>
                <div className="flex-1 min-w-[40px]"><div className="h-3 bg-slate-100"><div className="h-full" style={{ width: `${pct}%`, background: st.bar }} /></div></div>
                <span className="hidden w-10 text-right font-mono text-slate-500 sm:inline">{pct.toFixed(0)}%</span>
                <span className="w-20 text-right font-mono font-bold sm:w-24">{mil(r.s)}</span>
                <span className="w-16 text-right sm:w-20"><Yo pct={yoy} prev={r.ps} /></span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 뷰 토글 + 검색 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button onClick={() => { setView("brand"); setLimit(20); }} className={pillBtn(view === "brand")}>브랜드별 ({brands.length})</button>
          <button onClick={() => { setView("store"); setLimit(20); }} className={pillBtn(view === "store")}>지점별</button>
        </div>
        <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(20); }} placeholder={view === "brand" ? "브랜드 검색" : "지점 검색"} className={`${inputCompact} w-full max-w-[220px]`} />
      </div>

      {view === "brand" ? (
        <ScrollHint className="border-[2px] border-[#0a0a0a] bg-white">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead className="bg-[#0a0a0a] text-white">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">브랜드</th>
                <th className="px-2 py-2 text-center">등급</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left whitespace-nowrap">부문·복종</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">매장수</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">매출(백만)</th>
                <th className="hidden sm:table-cell px-3 py-2 text-right">이익률</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">전년비</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b, i) => (
                <tr key={`${b.division}|${b.cat}|${b.key}`} className="border-t border-slate-100 hover:bg-yellow-50">
                  <td className="px-3 py-2 font-mono text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-bold text-[#0a0a0a]">{b.key}</td>
                  <td className="px-2 py-2 text-center"><GradeBadge g={b.grade} /></td>
                  <td className="hidden sm:table-cell px-3 py-2 text-slate-500 whitespace-nowrap">{b.division === "패션" ? displayCat(b.cat) : displayDivision(b.division ?? "")}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{b.subCount}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{mil(b.s)}</td>
                  <td className="hidden sm:table-cell px-3 py-2 text-right font-mono text-slate-500">{b.gpm}%</td>
                  <td className="px-3 py-2 text-right"><Yo pct={b.yoyPct} prev={b.ps} /></td>
                </tr>
              ))}
              {brandRows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">결과 없음</td></tr>}
            </tbody>
          </table>
          {brandRows.length > visible.length && (
            <button onClick={() => setLimit((l) => l + 20)} className="w-full border-t-[2px] border-[#0a0a0a] bg-yellow-50 py-2.5 text-[12px] font-bold hover:bg-yellow-100">더 보기 (+20) · {visible.length}/{brandRows.length}</button>
          )}
        </ScrollHint>
      ) : (
        <ScrollHint className="border-[2px] border-[#0a0a0a] bg-white">
          <table className="w-full min-w-[420px] text-[12px]">
            <thead className="bg-[#0a0a0a] text-white">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">지점</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">BCD점수</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">A+B / 전체</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">매출(백만)</th>
              </tr>
            </thead>
            <tbody>
              {storeRows.slice(0, limit).map((s, i) => (
                <tr key={s.store} className="border-t border-slate-100 hover:bg-yellow-50">
                  <td className="px-3 py-2 font-mono text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-bold text-[#0a0a0a]">{s.store}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{s.bcd.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{s.ab} / {s.total}</td>
                  <td className="px-3 py-2 text-right font-mono">{mil(s.s)}</td>
                </tr>
              ))}
              {storeRows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">결과 없음</td></tr>}
            </tbody>
          </table>
          {storeRows.length > limit && (
            <button onClick={() => setLimit((l) => l + 20)} className="w-full border-t-[2px] border-[#0a0a0a] bg-yellow-50 py-2.5 text-[12px] font-bold hover:bg-yellow-100">더 보기 (+20) · {Math.min(limit, storeRows.length)}/{storeRows.length}</button>
          )}
        </ScrollHint>
      )}
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white p-3" style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="text-[11px] font-bold text-slate-500 truncate">{label}</div>
      <div className="mt-1 font-mono text-[20px] sm:text-[22px] font-extrabold leading-none">{value}</div>
      {sub && <div className={`mt-1 text-[10px] truncate ${tone === "warn" ? "text-amber-600 font-bold" : "text-slate-400"}`}>{sub}</div>}
    </div>
  );
}
