"use client";

import { memo, useCallback, useMemo, useState } from "react";
import ScrollHint from "@/components/ui/ScrollHint";
import UnitChip from "@/components/ui/UnitChip";
import StatusLegend from "@/components/ui/StatusLegend";
import { pillBtn, inputCompact } from "@/lib/tokens";
import { displayDivision, isHiddenCat, displayCat, catRank, divisionRank, OTHERS_KEY, OTHERS_LABEL } from "@/lib/sales/labels";
import type { OffRank, OffOthers } from "@/lib/sales/queries";

interface DivSummary { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface CatSummary { cat: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface Props {
  periodLabel: string;
  prevLabel: string;
  brands: OffRank[];          // division/cat 포함
  stores: OffRank[];          // 지점별 (하위=브랜드)
  divisions: DivSummary[];
  fashionCats: CatSummary[];
  others?: OffOthers | null;
  monthActive?: { brands: string[]; stores: string[]; detail: string[] } | null;
  /** 누적 개월수. >1 이면 하위 표에 "월평균" 컬럼 추가. 당월상세=1(미표시). */
  monthCount?: number;
}

const won = (n: number) => n.toLocaleString("ko-KR");
const eok = (n: number) => (n / 1e8).toFixed(1);
// 백만 단위 (상세 브랜드/지점 금액 통일)
const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR");
const milSigned = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n / 1e6).toLocaleString("ko-KR")}`;
function YoY({ pct, prev, closed }: { pct: number; prev?: number; closed?: boolean }) {
  if (closed) {
    return <span style={{ color: "#e53e3e", fontWeight: 700 }} title="전년 실적은 있으나 올해 매출 없음 (퇴점)">퇴점</span>;
  }
  if (prev !== undefined && prev === 0) {
    return <span style={{ color: "#7c3aed", fontWeight: 700 }} title="전년 동기간 실적 없음 (신규 또는 미집계)">신규</span>;
  }
  const up = pct >= 0;
  return <span className="whitespace-nowrap tabular-nums" style={{ color: up ? "#0d9e6e" : "#e53e3e", fontWeight: 700 }}>{up ? "▲" : "▼"}&nbsp;{Math.abs(pct).toFixed(1)}%</span>;
}

type Sel = { type: "cat" | "div"; key: string };
type Dir = "asc" | "desc";
type BSortKey = "key" | "subCount" | "s" | "g" | "gpm" | "yoyPct";
type SSortKey = "key" | "s" | "growthS" | "growthPct" | "g" | "growthG" | "growthGPct" | "area" | "dppSales" | "dppGp";
type OffSubLite = import("@/lib/sales/queries").OffSub;

export default function OfflineDetailTab(p: Props) {
  // 선택 칩 목록: 패션 복종("패션공통" 비노출) + 비패션 부문(F&B/기타/온라인, 기타→"라이프스타일" 라벨)
  const fashionChips = p.fashionCats
    .filter((c) => !isHiddenCat(c.cat))
    .sort((a, b) => catRank(a.cat) - catRank(b.cat))
    .map((c) => ({ type: "cat" as const, key: c.cat, label: displayCat(c.cat) || "(미분류)", s: c.s }));
  const divChips = p.divisions
    .filter((d) => d.division !== "패션")
    .sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
    .map((d) => ({ type: "div" as const, key: d.division, label: displayDivision(d.division), s: d.s }));
  // "그 외" 칩 — 항상 마지막
  const othersChip = p.others && p.others.brands.length
    ? [{ type: "div" as const, key: OTHERS_KEY, label: OTHERS_LABEL, s: p.others.total }]
    : [];
  const chips = [...fashionChips, ...divChips, ...othersChip];

  const [view, setView] = useState<"brand" | "store">("brand");
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
  // 지점별 브랜드 상세 섹션
  const [stExpanded, setStExpanded] = useState<string | null>(null);
  const [stLimit, setStLimit] = useState(10);
  const [stQ, setStQ] = useState("");
  const [stSel, setStSel] = useState<Sel | null>(null);   // null = 전체 복종
  const [stSort, setStSort] = useState<BSortKey>("s");    // 지점 랭킹 정렬
  const [stDir, setStDir] = useState<Dir>("desc");

  // 선택 복종/부문 기준으로 지점별 데이터 구성 (detailBrands → 지점 피벗)
  const storeData = useMemo<OffRank[]>(() => {
    if (!stSel) return p.stores;   // 전체: 지점 전체 복종 합계
    if (stSel.type === "div" && stSel.key === OTHERS_KEY) return p.others?.stores ?? [];
    const selBrands = p.brands.filter((b) => stSel.type === "cat"
      ? (b.division === "패션" && b.cat === stSel.key)
      : b.division === stSel.key);
    // 지점별로 해당 복종 브랜드들을 모음
    const m = new Map<string, { s: number; ps: number; g: number; pg: number; subs: OffSubLite[] }>();
    for (const b of selBrands) {
      for (const sub of b.bySub ?? []) {
        let e = m.get(sub.key);
        if (!e) { e = { s: 0, ps: 0, g: 0, pg: 0, subs: [] }; m.set(sub.key, e); }
        e.s += sub.s; e.ps += sub.ps; e.g += sub.g; e.pg += sub.pg;
        e.subs.push({ ...sub, key: b.key });   // 하위 = 브랜드 (지점 내)
      }
    }
    return [...m.entries()].map(([store, e]) => ({
      key: store, s: e.s, ps: e.ps, g: e.g, pg: e.pg,
      gpm: e.s ? +(e.g / e.s * 100).toFixed(1) : 0,
      yoyPct: e.ps ? +((e.s - e.ps) / e.ps * 100).toFixed(1) : 0,
      subCount: e.subs.filter((x) => x.s > 0).length,
      dppSales: 0, dppGp: 0,
      closed: e.s === 0 && e.ps > 0,
      bySub: e.subs,
    })).sort((a, b) => b.s - a.s);
  }, [stSel, p.stores, p.brands, p.others]);

  const storeRows = useMemo(() => {
    const base = stQ ? storeData.filter((s) => s.key.includes(stQ)) : storeData;
    const dir = stDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) =>
      stSort === "key" ? a.key.localeCompare(b.key, "ko") * dir : ((a[stSort] as number) - (b[stSort] as number)) * dir);
  }, [storeData, stQ, stSort, stDir]);
  const stVisible = storeRows.slice(0, stLimit);
  function toggleSt(k: BSortKey) {
    if (stSort === k) setStDir((d) => d === "asc" ? "desc" : "asc");
    else { setStSort(k); setStDir(k === "key" ? "asc" : "desc"); }
    setStExpanded(null); setStLimit(10);
  }
  const stArrow = (k: BSortKey) => stSort === k ? (stDir === "asc" ? " ▲" : " ▼") : "";

  // 이탈: 누적 매출 있으나 당월에 빠진 건
  const enableLeft = !!p.monthActive;
  const detailSet = useMemo(() => new Set(p.monthActive?.detail ?? []), [p.monthActive]);
  const storeSet = useMemo(() => new Set(p.monthActive?.stores ?? []), [p.monthActive]);
  const brandLeft = useCallback((r: OffRank) =>
    enableLeft && !r.closed && r.s > 0 && !detailSet.has(`${r.division ?? ""}|${r.cat ?? ""}|${r.key}`), [enableLeft, detailSet]);
  const storeLeft = useCallback((r: OffRank) =>
    enableLeft && !r.closed && r.s > 0 && !storeSet.has(r.key), [enableLeft, storeSet]);

  // 선택 카테고리 브랜드 (요약·칩 기준 — 검색 무관)
  const catRows = useMemo(() => {
    if (sel.type === "div" && sel.key === OTHERS_KEY) return p.others?.detailBrands ?? [];
    return p.brands.filter((b) => sel.type === "cat" ? (b.division === "패션" && b.cat === sel.key) : b.division === sel.key);
  }, [p.brands, p.others, sel]);

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
  const toggleS = useCallback((k: SSortKey) => {
    setSSort((cur) => { if (cur === k) { setSDir((d) => d === "asc" ? "desc" : "asc"); return cur; } setSDir(k === "key" ? "asc" : "desc"); return k; });
  }, []);
  const onToggleBrand = useCallback((key: string) => setExpanded((cur) => cur === key ? null : key), []);
  const onToggleStore = useCallback((key: string) => setStExpanded((cur) => cur === key ? null : key), []);
  const bArrow = (k: BSortKey) => bSort === k ? (bDir === "asc" ? " ▲" : " ▼") : "";

  const summary = useMemo(() => {
    const s = catRows.reduce((t, r) => t + r.s, 0);
    const ps = catRows.reduce((t, r) => t + r.ps, 0);
    const g = catRows.reduce((t, r) => t + r.g, 0);
    // 일평당 = Σ매출 / Σ(평·일). dppSales=매출/평일 이므로 평일=매출/dpp → 역산 합산
    let areaDays = 0;
    for (const r of catRows) if (r.dppSales) areaDays += r.s / r.dppSales;
    return {
      s, ps, g, gpm: s ? +(g / s * 100).toFixed(1) : 0,
      yoyPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0,
      brands: catRows.filter((r) => !r.closed).length,
      closedCount: catRows.filter((r) => r.closed).length,
      dppSales: areaDays ? Math.round(s / areaDays) : 0,
      dppGp: areaDays ? Math.round(g / areaDays) : 0,
    };
  }, [catRows]);

  // 그 외 탭은 본류 당월 활성 키에 없어 전부 '이탈'로 오인됨 → 이탈 판정 제외
  const isOthersSel = sel.type === "div" && sel.key === OTHERS_KEY;
  const isOthersStSel = stSel?.type === "div" && stSel?.key === OTHERS_KEY;

  const visible = rows.slice(0, limit);
  const selLabel = chips.find((c) => c.type === sel.type && c.key === sel.key)?.label ?? sel.key;

  return (
    <div className="space-y-4">
      {/* 뷰 토글: 브랜드 / 지점 */}
      <div className="flex items-center gap-1.5">
        <button onClick={() => setView("brand")} className={pillBtn(view === "brand")}>브랜드별</button>
        <button onClick={() => setView("store")} className={pillBtn(view === "store")}>지점별 ({p.stores.length})</button>
        <span className="ml-1"><UnitChip>단위: 백만원</UnitChip></span>
      </div>
      <StatusLegend items={enableLeft ? ["closed", "left", "new"] : ["closed", "new"]} />

      {view === "brand" && (<>
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
          className={`w-full max-w-[280px] ${inputCompact}`} />
        {q && <button onClick={() => setQ("")} className="text-[11px] text-slate-500 underline">초기화</button>}
        {q && <span className="text-[11px] text-slate-500">{rows.length}개 검색됨 (요약은 선택 카테고리 기준)</span>}
      </div>

      {/* 선택 요약 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card label={`${selLabel} 매출`} value={`${eok(summary.s)}억`} sub={`${won(summary.s)}원`} accent subSmOnly />
        <Card label={`전년 (${p.prevLabel})`} value={`${eok(summary.ps)}억`} />
        <Card label="전년대비" value={`${summary.yoyPct >= 0 ? "+" : ""}${summary.yoyPct}%`} tone={summary.yoyPct >= 0 ? "up" : "down"} />
        <Card label="이익률 / 브랜드수" value={`${summary.gpm}%`} sub={`${summary.brands}개 브랜드${summary.closedCount ? ` · 퇴점 ${summary.closedCount}` : ""}`} />
        <Card label="일평당매출" value={won(summary.dppSales)} sub="원/평·일" />
        <Card label="일평당이익" value={won(summary.dppGp)} sub="원/평·일" />
      </div>

      {/* 브랜드 랭킹 (지점 드릴다운) */}
      <ScrollHint className="border-[2px] border-[#0a0a0a] bg-white">
        <table className="w-full min-w-[480px] sm:min-w-[560px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white select-none">
            <tr>
              <th className="sticky left-0 z-[2] bg-[#0a0a0a] px-3 py-2 text-left w-10">#</th>
              <th className="sticky left-10 z-[2] bg-[#0a0a0a] px-3 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("key")}>브랜드{bArrow("key")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("subCount")}>매장수{bArrow("subCount")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("s")}>매출(백만){bArrow("s")}</th>
              <th className="hidden sm:table-cell px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("g")}>이익(백만){bArrow("g")}</th>
              <th className="hidden sm:table-cell px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("gpm")}>이익률{bArrow("gpm")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleB("yoyPct")}>전년비{bArrow("yoyPct")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const id = `${r.division ?? ""}|${r.cat ?? ""}|${r.key}`;
              return (
                <DetailRow key={id} id={id} row={r} rank={i + 1} firstColLabel="지점" left={!isOthersSel && brandLeft(r)}
                  open={expanded === id} onToggle={onToggleBrand} sSort={sSort} sDir={sDir} toggleS={toggleS} monthCount={p.monthCount} />
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
      </ScrollHint>
      </>)}

      {view === "store" && (<>
      {/* 복종/부문 칩 (전체 + 각 복종) */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => { setStSel(null); setStExpanded(null); setStLimit(10); }}
          className={`border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] font-bold transition ${!stSel ? "bg-[#0a0a0a] text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-slate-50"}`}>
          전체
        </button>
        {chips.map((c) => {
          const active = stSel?.type === c.type && stSel?.key === c.key;
          const isFashion = c.type === "cat";
          return (
            <button key={`st-${c.type}-${c.key}`} onClick={() => { setStSel({ type: c.type, key: c.key }); setStExpanded(null); setStLimit(10); }}
              className={`border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] font-bold transition ${active ? "text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-slate-50"}`}
              style={active ? { background: isFashion ? "#db2777" : "#7c3aed" } : undefined}>
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">지점을 클릭하면 {stSel ? "선택 복종" : "전 부문"} 입점 브랜드별 실적이 펼쳐집니다.</p>
        <input type="text" value={stQ} onChange={(e) => { setStQ(e.target.value); setStExpanded(null); setStLimit(10); }}
          placeholder="지점 검색"
          className={`w-full max-w-[200px] ${inputCompact}`} />
      </div>

      <ScrollHint className="border-[2px] border-[#0a0a0a] bg-white">
        <table className="w-full min-w-[480px] sm:min-w-[560px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white select-none">
            <tr>
              <th className="sticky left-0 z-[2] bg-[#0a0a0a] px-3 py-2 text-left w-10">#</th>
              <th className="sticky left-10 z-[2] bg-[#0a0a0a] px-3 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSt("key")}>지점{stArrow("key")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSt("subCount")}>브랜드수{stArrow("subCount")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSt("s")}>매출(백만){stArrow("s")}</th>
              <th className="hidden sm:table-cell px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSt("g")}>매총익(백만){stArrow("g")}</th>
              <th className="hidden sm:table-cell px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSt("gpm")}>이익률{stArrow("gpm")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSt("yoyPct")}>전년비{stArrow("yoyPct")}</th>
            </tr>
          </thead>
          <tbody>
            {stVisible.map((st, i) => (
              <DetailRow key={st.key} id={st.key} row={st} rank={i + 1} firstColLabel="브랜드" left={!isOthersStSel && storeLeft(st)}
                open={stExpanded === st.key} onToggle={onToggleStore} sSort={sSort} sDir={sDir} toggleS={toggleS} monthCount={p.monthCount} />
            ))}
            {storeRows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">지점 데이터 없음</td></tr>}
          </tbody>
        </table>
        {storeRows.length > stVisible.length && (
          <button onClick={() => setStLimit((l) => l + 10)}
            className="w-full border-t-[2px] border-[#0a0a0a] bg-yellow-50 py-2.5 text-[12px] font-bold text-[#0a0a0a] hover:bg-yellow-100">
            더 보기 (+10) · {stVisible.length}/{storeRows.length}
          </button>
        )}
      </ScrollHint>
      </>)}
    </div>
  );
}

// 드릴다운 하위 표 (브랜드→지점 / 지점→브랜드 공용)
// 브랜드/지점 공용 행 (메모 — 펼침 토글 시 해당 행만 리렌더)
const DetailRow = memo(function DetailRow({ row, id, rank, firstColLabel, open, onToggle, sSort, sDir, toggleS, left, monthCount }: {
  row: OffRank; id: string; rank: number; firstColLabel: string; open: boolean;
  onToggle: (id: string) => void; sSort: SSortKey; sDir: Dir; toggleS: (k: SSortKey) => void; left?: boolean;
  monthCount?: number;
}) {
  const subTitle = firstColLabel === "지점" ? "지점별 상세" : "브랜드별 상세";
  return (
    <>
      <tr className={`group border-t border-slate-100 ${row.closed ? "opacity-60" : "cursor-pointer hover:bg-yellow-50"} ${open ? "bg-yellow-50" : ""}`} onClick={() => { if (!row.closed) onToggle(id); }}>
        <td className={`sticky left-0 z-[1] px-3 py-2 font-mono text-slate-400 group-hover:bg-yellow-50 ${open ? "bg-yellow-50" : "bg-white"}`}><span className="mr-1 text-[9px]">{row.closed ? "" : open ? "▼" : "▶"}</span>{rank}</td>
        <td className={`sticky left-10 z-[1] px-3 py-2 font-bold text-[#0a0a0a] group-hover:bg-yellow-50 ${open ? "bg-yellow-50" : "bg-white"}`}>
          {row.key}
          {row.closed && <span className="ml-1.5 border border-rose-500 px-1 py-0 text-[9px] font-extrabold text-rose-600 align-middle">퇴점</span>}
          {!row.closed && left && <span className="ml-1.5 border border-amber-500 px-1 py-0 text-[9px] font-extrabold text-amber-600 align-middle" title="누적 매출 있으나 당월 빠짐">이탈</span>}
        </td>
        <td className="px-3 py-2 text-right font-mono text-slate-500">{row.subCount}</td>
        <td className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap">{row.closed ? "—" : mil(row.s)}</td>
        <td className="hidden sm:table-cell px-3 py-2 text-right font-mono whitespace-nowrap">{row.closed ? "—" : mil(row.g)}</td>
        <td className="hidden sm:table-cell px-3 py-2 text-right font-mono text-slate-500">{row.closed ? "—" : `${row.gpm}%`}</td>
        <td className="px-3 py-2 text-right"><YoY pct={row.yoyPct} prev={row.ps} closed={row.closed} /></td>
      </tr>
      {open && row.bySub && row.bySub.length > 0 && (
        <tr className="bg-slate-50">
          <td></td>
          <td colSpan={6} className="px-3 py-2">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{subTitle} ({row.bySub.length})</div>
            <SubBreakdownTable bySub={row.bySub} firstColLabel={firstColLabel} sSort={sSort} sDir={sDir} toggleS={toggleS} monthCount={monthCount} />
          </td>
        </tr>
      )}
    </>
  );
});

const SubBreakdownTable = memo(function SubBreakdownTable({ bySub, firstColLabel, sSort, sDir, toggleS, monthCount }: {
  bySub: OffSubLite[]; firstColLabel: string;
  sSort: SSortKey; sDir: Dir; toggleS: (k: SSortKey) => void;
  monthCount?: number;
}) {
  const [limit, setLimit] = useState(10);
  const rows = useMemo(() => {
    const dir = sDir === "asc" ? 1 : -1;
    return [...bySub].sort((a, b) =>
      sSort === "key" ? a.key.localeCompare(b.key, "ko") * dir : ((a[sSort] as number) - (b[sSort] as number)) * dir);
  }, [bySub, sSort, sDir]);
  const shown = rows.slice(0, limit);
  const sArrow = (k: SSortKey) => sSort === k ? (sDir === "asc" ? " ▲" : " ▼") : "";
  // 누적상세(monthCount>1)에서만 "월평균" 컬럼 표시. 매출/누적개월수 — DB 없이 계산.
  const showAvg = (monthCount ?? 1) > 1;
  const mc = monthCount ?? 1;
  return (
    <ScrollHint>
      <table className="w-full min-w-[720px] text-[11px]">
        <thead className="text-slate-500 select-none">
          <tr className="border-b border-slate-200">
            <th className="sticky left-0 z-[1] bg-slate-50 px-2 py-1 text-left whitespace-nowrap cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("key")}>{firstColLabel}{sArrow("key")}</th>
            <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("s")}>매출(백만){sArrow("s")}</th>
            {showAvg && (
              <th className="px-2 py-1 text-right cursor-pointer hover:text-[#0a0a0a]" onClick={() => toggleS("s")} title={`매출 ÷ ${mc}개월`}>월평균(백만){sArrow("s")}</th>
            )}
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
          {shown.map((s) => (
            <tr key={s.key} className={`border-b border-slate-100 ${s.closed ? "opacity-60" : ""}`}>
              <td className="sticky left-0 z-[1] bg-slate-50 px-2 py-1 font-bold text-[#0a0a0a] whitespace-nowrap">
                {s.key}
                {s.closed && <span className="ml-1.5 border border-rose-500 px-1 py-0 text-[9px] font-extrabold text-rose-600 align-middle">퇴점</span>}
              </td>
              <td className="px-2 py-1 text-right font-mono font-bold">{s.closed ? "—" : mil(s.s)}</td>
              {showAvg && (
                <td className="px-2 py-1 text-right font-mono text-slate-600">{s.closed ? "—" : mil(s.s / mc)}</td>
              )}
              <td className="px-2 py-1 text-right font-mono" style={{ color: s.ps === 0 ? "#7c3aed" : s.growthS >= 0 ? "#0d9e6e" : "#e53e3e" }}>{s.ps === 0 ? "—" : milSigned(s.growthS)}</td>
              <td className="px-2 py-1 text-right"><YoY pct={s.growthPct} prev={s.ps} closed={s.closed} /></td>
              <td className="px-2 py-1 text-right font-mono">{s.closed ? "—" : mil(s.g)}</td>
              <td className="px-2 py-1 text-right font-mono" style={{ color: s.pg === 0 ? "#7c3aed" : s.growthG >= 0 ? "#0d9e6e" : "#e53e3e" }}>{s.pg === 0 ? "—" : milSigned(s.growthG)}</td>
              <td className="px-2 py-1 text-right"><YoY pct={s.growthGPct} prev={s.pg} closed={s.closed} /></td>
              <td className="px-2 py-1 text-right font-mono text-slate-500">{s.area ? `${s.area}평` : "—"}</td>
              <td className="px-2 py-1 text-right font-mono text-slate-500">{s.dppSales ? won(s.dppSales) : "—"}</td>
              <td className="px-2 py-1 text-right font-mono text-slate-500">{s.dppGp ? won(s.dppGp) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <button onClick={() => setLimit((l) => l + 10)}
          className="w-full border-t border-slate-200 bg-slate-50 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100">
          더 보기 (+10) · {shown.length}/{rows.length}
        </button>
      )}
    </ScrollHint>
  );
});

function Card({ label, value, sub, accent, tone, subSmOnly }: { label: string; value: string; sub?: string; accent?: boolean; tone?: "up" | "down"; subSmOnly?: boolean }) {
  const color = tone === "up" ? "#0d9e6e" : tone === "down" ? "#e53e3e" : "#0a0a0a";
  return (
    <div className={`border-[2px] border-[#0a0a0a] p-3 ${accent ? "bg-yellow-100" : "bg-white"}`} style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="text-[11px] font-bold text-slate-500 truncate">{label}</div>
      <div className="mt-1 font-mono text-[18px] sm:text-[22px] font-extrabold leading-none" style={{ color }}>{value}</div>
      {sub && <div className={`mt-1 text-[10px] text-slate-400 truncate ${subSmOnly ? "hidden sm:block" : ""}`}>{sub}</div>}
    </div>
  );
}
