"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BcdBrand } from "@/lib/sales/queries";
import { displayDivision, isHiddenCat, displayCat, catRank } from "@/lib/sales/labels";
import { pillBtn, inputCompact } from "@/lib/tokens";
import ScrollHint from "@/components/ui/ScrollHint";
import UnitChip from "@/components/ui/UnitChip";
import { setBrandGrade } from "../_actions";

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
  X: { bar: "#94a3b8", chip: "bg-slate-200 text-slate-500 border-slate-400", label: "제외" },
  "": { bar: "#94a3b8", chip: "bg-slate-100 text-slate-600 border-slate-300", label: "미분류" },
};

const gradeIndex = (g: string): number => {
  const i = GRADES.indexOf(g as typeof GRADES[number]);
  return i < 0 ? 99 : i;
};

function GradeBadge({ g }: { g: string }) {
  const s = GRADE_STYLE[g] ?? GRADE_STYLE[""];
  return <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-extrabold ${s.chip}`}>{s.label}</span>;
}

/** 관리자용 등급 직접 지정 — 변경 즉시 brand_grade에 저장(전역 반영) */
function GradeSelect({ grade, disabled, onChange }: { grade: string; disabled: boolean; onChange: (g: string) => void }) {
  const s = GRADE_STYLE[grade] ?? GRADE_STYLE[""];
  return (
    <select value={grade} disabled={disabled} onChange={(e) => onChange(e.target.value)}
      title="등급 변경 시 전체 BCD에 즉시 반영"
      className={`border px-1 py-0.5 text-[11px] font-extrabold outline-none disabled:opacity-50 ${grade ? s.chip : "border-amber-400 bg-amber-50 text-amber-700"}`}>
      <option value="">미분류</option>
      {["S", "A", "B", "C", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
      <option value="X">제외(팝업 등)</option>
    </select>
  );
}

type BSort = "key" | "grade" | "subCount" | "s" | "gpm" | "yoyPct";
type SSort = "store" | "bcd" | "total" | "s";
function Yo({ pct, prev }: { pct: number; prev?: number }) {
  if (prev !== undefined && prev === 0) return <span className="font-bold text-violet-600">신규</span>;
  const up = pct >= 0;
  return <span className="whitespace-nowrap tabular-nums font-bold" style={{ color: up ? "#0d9e6e" : "#e53e3e" }}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>;
}

export default function BcdClient({ cum, month, canEdit = false }: { cum: BcdData | null; month: BcdData | null; canEdit?: boolean }) {
  const [period, setPeriod] = useState<"cum" | "month">("cum");
  const d = period === "cum" ? cum : month;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 낙관적 등급 — 저장 직후 서버 새로고침 전에도 즉시 목록에서 반영
  const [localGrades, setLocalGrades] = useState<Record<string, string>>({});

  function saveGrade(brand: string, grade: string) {
    setLocalGrades((m) => ({ ...m, [brand]: grade }));
    startTransition(async () => {
      const res = await setBrandGrade(brand, grade);
      if (res.ok) { toast.success(`${brand} → ${GRADE_STYLE[grade]?.label ?? "미분류"} 저장`); router.refresh(); }
      else { toast.error(res.error); setLocalGrades((m) => { const n = { ...m }; delete n[brand]; return n; }); }
    });
  }

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
      {d ? <BcdView d={d} canEdit={canEdit} onSetGrade={saveGrade} pending={pending} localGrades={localGrades} /> : <div className="text-[13px] text-slate-400">해당 기간 데이터 없음</div>}
    </div>
  );
}

type Sel = { type: "cat" | "div"; key: string } | null;

function BcdView({ d, canEdit, onSetGrade, pending, localGrades }: { d: BcdData; canEdit: boolean; onSetGrade: (brand: string, grade: string) => void; pending: boolean; localGrades: Record<string, string> }) {
  const [sel, setSel] = useState<Sel>(null);
  const [view, setView] = useState<"brand" | "store">("brand");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(20);
  const [bSort, setBSort] = useState<BSort>("s");
  const [bDir, setBDir] = useState<"asc" | "desc">("desc");
  const [sSort, setSSort] = useState<SSort>("bcd");
  const [sDir, setSDir] = useState<"asc" | "desc">("desc");
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [listMode, setListMode] = useState<"all" | "unmatched" | "excluded" | "nonfashion">("all");

  function toggleB(k: BSort) {
    if (bSort === k) setBDir((d) => d === "asc" ? "desc" : "asc");
    else { setBSort(k); setBDir(k === "key" ? "asc" : "desc"); }
    setLimit(20);
  }
  const bArrow = (k: BSort) => bSort === k ? (bDir === "asc" ? " ▲" : " ▼") : "";
  function toggleS(k: SSort) {
    if (sSort === k) setSDir((d) => d === "asc" ? "desc" : "asc");
    else { setSSort(k); setSDir(k === "store" ? "asc" : "desc"); }
    setLimit(20); setOpenStore(null);
  }
  const sArrow = (k: SSort) => sSort === k ? (sDir === "asc" ? " ▲" : " ▼") : "";

  // BCD 점수는 패션 전용 → 카테고리 칩은 패션 복종만. (F&B·라이프스타일은 '비패션' 버킷으로 분리)
  const chips = useMemo(() =>
    d.fashionCats.filter((c) => !isHiddenCat(c.cat)).sort((a, b) => catRank(a.cat) - catRank(b.cat))
      .map((c) => ({ type: "cat" as const, key: c.cat, label: displayCat(c.cat) || "(미분류)" })),
  [d]);

  // 카테고리 필터 + 낙관적 등급(localGrades) 반영
  const brands = useMemo(() => {
    const apply = (b: BcdBrand) => (b.key in localGrades ? { ...b, grade: localGrades[b.key] } : b);
    const base = !sel ? d.brands : d.brands.filter((b) => sel.type === "cat" ? (b.division === "패션" && b.cat === sel.key) : b.division === sel.key);
    return base.map(apply);
  }, [d.brands, sel, localGrades]);

  // 점수 대상 = 패션 부문이면서 제외(X) 아님. 비패션(F&B·라이프스타일)·제외는 분모에서 빠짐.
  const scored = useMemo(() => brands.filter((b) => b.division === "패션" && b.grade !== "X"), [brands]);
  const nonFashionCount = useMemo(() => brands.filter((b) => b.division !== "패션").length, [brands]);
  const excludedCount = useMemo(() => brands.filter((b) => b.division === "패션" && b.grade === "X").length, [brands]);

  // 등급별 집계 + BCD점수 (제외 제외, 필터된 집합 기준)
  const agg = useMemo(() => {
    const m = new Map<string, { grade: string; brCnt: number; stCnt: number; prevStCnt: number; s: number; ps: number; g: number }>();
    for (const b of scored) {
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
    return { rows, totalS, totalSt, abSt, score, scorePrev, diff: score - scorePrev, unmatched: scored.filter((b) => !b.grade).length };
  }, [scored]);

  // 지점별 — 각 지점의 등급 슬롯으로 BCD점수 + 입점 브랜드 등급 목록(드릴다운). 제외 브랜드는 빠짐
  const storeRows = useMemo(() => {
    const m = new Map<string, { store: string; total: number; ab: number; s: number; items: { brand: string; grade: string; s: number }[] }>();
    for (const b of scored) for (const sub of b.bySub ?? []) {
      if (!(sub.s > 0)) continue;
      const e = m.get(sub.key) ?? { store: sub.key, total: 0, ab: 0, s: 0, items: [] };
      e.total++; e.s += sub.s; if (b.grade === "A" || b.grade === "B") e.ab++;
      e.items.push({ brand: b.key, grade: b.grade, s: sub.s });
      m.set(sub.key, e);
    }
    let rows = [...m.values()].map((e) => ({ ...e, bcd: e.total ? e.ab / e.total * 100 : 0 }));
    if (q) rows = rows.filter((r) => r.store.includes(q));
    const dir = sDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => sSort === "store" ? a.store.localeCompare(b.store, "ko") * dir : ((a[sSort] as number) - (b[sSort] as number)) * dir);
  }, [scored, q, sSort, sDir]);

  const brandRows = useMemo(() => {
    let rows = listMode === "unmatched" ? brands.filter((b) => b.division === "패션" && !b.grade)
      : listMode === "excluded" ? brands.filter((b) => b.division === "패션" && b.grade === "X")
      : listMode === "nonfashion" ? brands.filter((b) => b.division !== "패션")
      : brands.filter((b) => b.division === "패션" && b.grade !== "X");   // 기본 = 패션 점수대상
    if (q) rows = rows.filter((b) => b.key.includes(q) || displayCat(b.cat).includes(q));
    const dir = bDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) =>
      bSort === "key" ? a.key.localeCompare(b.key, "ko") * dir
      : bSort === "grade" ? (gradeIndex(a.grade) - gradeIndex(b.grade)) * dir
      : ((a[bSort] as number) - (b[bSort] as number)) * dir);
  }, [brands, q, bSort, bDir, listMode]);

  const visible = brandRows.slice(0, limit);

  return (
    <div className="space-y-4">
      {/* BCD 점수 + 요약 카드 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        <div className="border-[2px] border-[#0a0a0a] bg-yellow-100 p-3 overflow-hidden" style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
          <div className="text-[11px] font-bold text-slate-500 truncate">BCD점수 (A+B비율)</div>
          <div className="mt-1 flex items-baseline gap-0.5 whitespace-nowrap">
            <span className="font-mono text-[22px] sm:text-[26px] font-extrabold leading-none tabular-nums">{agg.score.toFixed(1)}</span><span className="text-[12px] font-bold">점</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[10px]">
            <span className="font-bold tabular-nums" style={{ color: agg.diff >= 0 ? "#0d9e6e" : "#e53e3e" }}>{agg.diff >= 0 ? "▲" : "▼"}{Math.abs(agg.diff).toFixed(1)}</span>
            <span className="text-slate-400">전년 {agg.scorePrev.toFixed(1)}점</span>
          </div>
        </div>
        <Card label="A+B / 전체 매장" value={`${agg.abSt.toLocaleString()}/${agg.totalSt.toLocaleString()}`} sub="퇴점·제외 뺀 분모" />
        <Card label={`${d.periodLabel} 매출`} value={`${eok(agg.totalS)}억`} sub={`${mil(agg.totalS)}백만`} />
        <button type="button" onClick={() => { if (agg.unmatched || listMode === "unmatched") { setListMode((m) => m === "unmatched" ? "all" : "unmatched"); setView("brand"); setLimit(20); } }}
          className={`border-[2px] border-[#0a0a0a] p-3 text-left overflow-hidden ${listMode === "unmatched" ? "bg-amber-200" : "bg-white"} ${agg.unmatched ? "cursor-pointer hover:bg-amber-50" : "cursor-default"}`}
          style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
          <div className="text-[11px] font-bold text-slate-500 truncate">미분류 {agg.unmatched ? "(클릭→목록)" : ""}</div>
          <div className="mt-1 font-mono text-[16px] sm:text-[18px] lg:text-[22px] font-extrabold leading-none tabular-nums truncate">{agg.unmatched.toLocaleString()}</div>
          <div className={`mt-1 text-[10px] truncate ${agg.unmatched ? "font-bold text-amber-600" : "text-slate-400"}`}>{listMode === "unmatched" ? "미분류만 · 다시 클릭 해제" : agg.unmatched ? "등급 미매칭 — 클릭 확인" : "전부 매칭됨"}</div>
        </button>
        <button type="button" onClick={() => { if (excludedCount || listMode === "excluded") { setListMode((m) => m === "excluded" ? "all" : "excluded"); setView("brand"); setLimit(20); } }}
          className={`border-[2px] border-[#0a0a0a] p-3 text-left overflow-hidden ${listMode === "excluded" ? "bg-slate-300" : "bg-white"} ${canEdit || excludedCount ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}
          style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
          <div className="text-[11px] font-bold text-slate-500 truncate">제외 (분모 제외)</div>
          <div className="mt-1 font-mono text-[16px] sm:text-[18px] lg:text-[22px] font-extrabold leading-none tabular-nums truncate">{excludedCount.toLocaleString()}</div>
          <div className="mt-1 text-[10px] truncate text-slate-400">{listMode === "excluded" ? "제외만 · 다시 클릭 해제" : "팝업 등 점수 비대상 · 클릭 확인"}</div>
        </button>
        <button type="button" onClick={() => { if (nonFashionCount || listMode === "nonfashion") { setListMode((m) => m === "nonfashion" ? "all" : "nonfashion"); setView("brand"); setLimit(20); } }}
          className={`border-[2px] border-[#0a0a0a] p-3 text-left overflow-hidden ${listMode === "nonfashion" ? "bg-cyan-200" : "bg-white"} ${nonFashionCount ? "cursor-pointer hover:bg-cyan-50" : "cursor-default"}`}
          style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
          <div className="text-[11px] font-bold text-slate-500 truncate">비패션 (분모 제외)</div>
          <div className="mt-1 font-mono text-[16px] sm:text-[18px] lg:text-[22px] font-extrabold leading-none tabular-nums truncate">{nonFashionCount.toLocaleString()}</div>
          <div className="mt-1 text-[10px] truncate text-slate-400">{listMode === "nonfashion" ? "비패션만 · 다시 클릭 해제" : "F&B·라이프스타일 · 클릭 확인"}</div>
        </button>
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
                <span className="hidden w-24 shrink-0 whitespace-nowrap text-right font-mono text-[10px] tabular-nums text-slate-500 sm:inline">{r.brCnt}개 · {r.stCnt}점</span>
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
            <thead className="bg-[#0a0a0a] text-white select-none">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("key")}>브랜드{bArrow("key")}</th>
                <th className="px-2 py-2 text-center cursor-pointer hover:bg-white/10" onClick={() => toggleB("grade")}>등급{bArrow("grade")}</th>
                <th className="hidden sm:table-cell px-3 py-2 text-left whitespace-nowrap">부문·복종</th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("subCount")}>매장수{bArrow("subCount")}</th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("s")}>매출(백만){bArrow("s")}</th>
                <th className="hidden sm:table-cell px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleB("gpm")}>이익률{bArrow("gpm")}</th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("yoyPct")}>전년비{bArrow("yoyPct")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b, i) => (
                <tr key={`${b.division}|${b.cat}|${b.key}`} className="border-t border-slate-100 hover:bg-yellow-50">
                  <td className="px-3 py-2 font-mono text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-bold text-[#0a0a0a]">{b.key}</td>
                  <td className="px-2 py-2 text-center">
                    {b.division !== "패션"
                      ? <span className="inline-flex items-center gap-1" title="비패션 — 점수 분모에서 제외(등급은 보존)">
                          <GradeBadge g={b.grade} /><span className="text-[9px] font-bold text-cyan-700">비패션</span>
                        </span>
                      : canEdit
                        ? <GradeSelect grade={b.grade} disabled={pending} onChange={(g) => onSetGrade(b.key, g)} />
                        : <GradeBadge g={b.grade} />}
                  </td>
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
            <thead className="bg-[#0a0a0a] text-white select-none">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleS("store")}>지점{sArrow("store")}</th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleS("bcd")}>BCD점수{sArrow("bcd")}</th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleS("total")}>A+B / 전체{sArrow("total")}</th>
                <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleS("s")}>매출(백만){sArrow("s")}</th>
              </tr>
            </thead>
            <tbody>
              {storeRows.slice(0, limit).map((s, i) => {
                const open = openStore === s.store;
                return (
                  <Fragment key={s.store}>
                    <tr className={`group border-t border-slate-100 cursor-pointer hover:bg-yellow-50 ${open ? "bg-yellow-50" : ""}`} onClick={() => setOpenStore(open ? null : s.store)}>
                      <td className="px-3 py-2 font-mono text-slate-400"><span className="mr-1 text-[9px]">{open ? "▼" : "▶"}</span>{i + 1}</td>
                      <td className="px-3 py-2 font-bold text-[#0a0a0a]">{s.store}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{s.bcd.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500 whitespace-nowrap">{s.ab} / {s.total}</td>
                      <td className="px-3 py-2 text-right font-mono">{mil(s.s)}</td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50">
                        <td></td>
                        <td colSpan={4} className="px-3 py-2">
                          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">입점 브랜드 등급 ({s.items.length})</div>
                          <div className="flex flex-col gap-1">
                            {[...s.items].sort((a, b) => gradeIndex(a.grade) - gradeIndex(b.grade) || b.s - a.s).map((it) => (
                              <div key={it.brand} className="flex items-center gap-2 text-[11px]">
                                <span className="w-12 shrink-0"><GradeBadge g={it.grade} /></span>
                                <span className="flex-1 font-bold text-[#0a0a0a] truncate">{it.brand}</span>
                                <span className="w-20 text-right font-mono font-bold">{mil(it.s)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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
    <div className="border-[2px] border-[#0a0a0a] bg-white p-3 overflow-hidden" style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="text-[11px] font-bold text-slate-500 truncate">{label}</div>
      <div className="mt-1 font-mono text-[15px] sm:text-[17px] lg:text-[22px] font-extrabold leading-none tabular-nums truncate">{value}</div>
      {sub && <div className={`mt-1 text-[10px] truncate ${tone === "warn" ? "text-amber-600 font-bold" : "text-slate-400"}`}>{sub}</div>}
    </div>
  );
}
