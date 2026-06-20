"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { OffRank } from "@/lib/sales/queries";
import { downloadCsv } from "@/lib/sales/exportCsv";
import { displayDivision, isHiddenCat, displayCat, catRank, divisionRank } from "@/lib/sales/labels";
import ScrollHint from "@/components/ui/ScrollHint";

interface DivSummary { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface CatSummary { cat: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
interface Props {
  periodLabel: string;
  prevLabel: string;
  total: number; prevTotal: number; gTotal: number; gpm: number; yoyPct: number;
  brands: OffRank[]; stores: OffRank[];
  divisions: DivSummary[];
  fashionCats: CatSummary[];
  monthActive?: { brands: string[]; stores: string[]; detail: string[] } | null;
}

const won = (n: number) => n.toLocaleString("ko-KR");
const eok = (n: number) => (n / 1e8).toFixed(1);
const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR");   // 백만
function YoY({ pct, prev, closed }: { pct: number; prev?: number; closed?: boolean }) {
  // 퇴점: 전년 실적은 있으나 올해 매출 없음
  if (closed) {
    return <span style={{ color: "#e53e3e", fontWeight: 700 }} title="전년 실적은 있으나 올해 매출 없음 (퇴점)">퇴점</span>;
  }
  // 전년 실적 자체가 없으면 0% 정체가 아니라 "신규/전년없음" — 구분 표시
  if (prev !== undefined && prev === 0) {
    return <span style={{ color: "#7c3aed", fontWeight: 700 }} title="전년 동기간 실적 없음 (신규 또는 미집계)">신규</span>;
  }
  const up = pct >= 0;
  return <span className="whitespace-nowrap tabular-nums" style={{ color: up ? "#0d9e6e" : "#e53e3e", fontWeight: 700 }}>{up ? "▲" : "▼"}&nbsp;{Math.abs(pct).toFixed(1)}%</span>;
}
type SortKey = "key" | "s" | "g" | "gpm" | "yoyPct";

export default function OfflineTab(p: Props) {
  const [view, setView] = useState<"brand" | "store">("brand");
  const [q, setQ] = useState("");
  const [div, setDiv] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("s");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(10);   // 초기 표시 행 수 (점진 확장)
  const [closedOnly, setClosedOnly] = useState(false);   // 퇴점만 보기
  const [leftOnly, setLeftOnly] = useState(false);       // 이탈만 보기

  const base = view === "brand" ? p.brands : p.stores;
  // 이탈: 누적 매출 있으나 당월에 빠진 건 (완전퇴점 제외)
  const enableLeft = !!p.monthActive;
  const activeSet = useMemo(
    () => new Set(p.monthActive ? (view === "brand" ? p.monthActive.brands : p.monthActive.stores) : []),
    [p.monthActive, view],
  );
  const isLeft = useCallback(
    (r: OffRank) => enableLeft && !r.closed && r.s > 0 && !activeSet.has(r.key),
    [enableLeft, activeSet],
  );
  const closedCount = useMemo(() => base.filter((r) => r.closed).length, [base]);
  const leftCount = useMemo(() => base.filter(isLeft).length, [base, isLeft]);
  const filtered = useMemo(() => {
    let list = base;
    if (closedOnly) list = list.filter((r) => r.closed);
    if (leftOnly) list = list.filter(isLeft);
    if (div && view === "brand") list = list.filter((r) => r.division === div);
    if (q) list = list.filter((r) => r.key.includes(q) || (r.cat ?? "").includes(q) || displayCat(r.cat).includes(q));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) =>
      sortKey === "key" ? a.key.localeCompare(b.key, "ko") * dir : ((a[sortKey] as number) - (b[sortKey] as number)) * dir);
  }, [base, q, div, view, sortKey, sortDir, closedOnly, leftOnly, isLeft]);

  // 실제 렌더할 행 (상위 limit개만 — 수백 행 동시 렌더로 인한 멈춤 방지)
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const switchView = useCallback((v: "brand" | "store") => { setView(v); setExpanded(null); setLimit(10); }, []);
  const onToggleRow = useCallback((key: string) => setExpanded((cur) => (cur === key ? null : key)), []);
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "key" ? "asc" : "desc"); }
    setExpanded(null); setLimit(10);
  }
  function onSearch(v: string) { setQ(v); setExpanded(null); setLimit(10); }
  const arrow = (k: SortKey) => sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  const subLabel = view === "brand" ? "지점" : "브랜드";

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card label={`${p.periodLabel} 매출`} value={`${eok(p.total)}억`} sub={`${won(p.total)}원`} accent />
        <Card label={`전년 (${p.prevLabel})`} value={`${eok(p.prevTotal)}억`} sub={`${won(p.prevTotal)}원`} />
        <Card label="전년대비" value={`${p.yoyPct >= 0 ? "+" : ""}${p.yoyPct}%`} tone={p.yoyPct >= 0 ? "up" : "down"} />
        <Card label="이익 / 이익률" value={`${eok(p.gTotal)}억`} sub={`GPM ${p.gpm}%`} />
      </div>

      {/* 부문별 요약 (패션 → F&B → 라이프스타일) */}
      <BarSection title={`부문별 매출 (백만 · ${p.periodLabel})`} barColor="#a78bfa"
        rows={[...p.divisions].sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
          .map((d) => ({ key: d.division, label: displayDivision(d.division), s: d.s, ps: d.ps, gpm: d.gpm, yoyPct: d.yoyPct }))}
        total={p.total} activeKey={div} onPick={(k) => setDiv(div === k ? null : k)} />

      {/* 패션 복종별 요약 ("패션공통" 비노출, 지정 순서) */}
      {(() => {
        const visibleCats = p.fashionCats.filter((c) => !isHiddenCat(c.cat)).sort((a, b) => catRank(a.cat) - catRank(b.cat));
        if (visibleCats.length === 0) return null;
        return (
          <BarSection title={`패션 복종별 매출 (백만 · ${p.periodLabel})`} barColor="#f472b6"
            rows={visibleCats.map((c) => ({ key: c.cat, label: displayCat(c.cat), s: c.s, ps: c.ps, gpm: c.gpm, yoyPct: c.yoyPct }))}
            total={visibleCats.reduce((t, c) => t + c.s, 0)} activeKey={null} onPick={() => {}} />
        );
      })()}

      {div && <div className="border-[2px] border-[#0a0a0a] bg-yellow-50 px-3 py-1.5 text-[11px] text-slate-600">부문 <b>{displayDivision(div)}</b> 필터 중 · <button onClick={() => setDiv(null)} className="underline">전체 보기</button></div>}

      {/* 토글 + 검색 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["brand", "store"] as const).map((v) => (
            <button key={v} onClick={() => switchView(v)}
              className={`border-[2px] border-[#0a0a0a] px-4 py-1.5 text-[12px] font-bold transition ${view === v ? "bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-yellow-50"}`}>
              {v === "brand" ? `브랜드 (${p.brands.length})` : `지점 (${p.stores.length})`}
            </button>
          ))}
          {closedCount > 0 && (
            <button onClick={() => { setClosedOnly((c) => !c); setLeftOnly(false); setExpanded(null); setLimit(closedOnly ? 10 : closedCount); }}
              className={`border-[2px] border-rose-500 px-3 py-1.5 text-[12px] font-bold transition ${closedOnly ? "bg-rose-500 text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white text-rose-600 hover:bg-rose-50"}`}
              title="전년 실적은 있으나 올해 매출 없는 항목만 보기">
              퇴점 {closedCount}
            </button>
          )}
          {leftCount > 0 && (
            <button onClick={() => { setLeftOnly((c) => !c); setClosedOnly(false); setExpanded(null); setLimit(leftOnly ? 10 : leftCount); }}
              className={`border-[2px] border-amber-500 px-3 py-1.5 text-[12px] font-bold transition ${leftOnly ? "bg-amber-500 text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white text-amber-600 hover:bg-amber-50"}`}
              title="누적 매출은 있으나 당월에 빠진 항목(이탈)만 보기">
              이탈 {leftCount}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={q} onChange={(e) => onSearch(e.target.value)} placeholder={view === "brand" ? "브랜드/복종 검색" : "지점 검색"}
            className="border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] focus:outline-none focus:bg-yellow-50" />
          <button
            onClick={() => {
              const header = view === "brand"
                ? ["순위", "브랜드", "복종", "매장수", "매출(백만)", "이익(백만)", "이익률%", "전년매출(백만)", "전년비%"]
                : ["순위", "지점", "브랜드수", "매출(백만)", "이익(백만)", "이익률%", "전년매출(백만)", "전년비%"];
              const yoyCell = (r: OffRank) => r.closed ? "퇴점" : r.ps === 0 ? "신규" : r.yoyPct;
              const m = (n: number) => Math.round(n / 1e6);
              const body = filtered.map((r, i) => view === "brand"
                ? [i + 1, r.key, displayCat(r.cat), r.subCount, m(r.s), m(r.g), r.gpm, m(r.ps), yoyCell(r)]
                : [i + 1, r.key, r.subCount, m(r.s), m(r.g), r.gpm, m(r.ps), yoyCell(r)]);
              downloadCsv(`${p.periodLabel}_${view === "brand" ? "브랜드" : "지점"}_랭킹`, [header, ...body]);
            }}
            className="shrink-0 border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[12px] font-bold hover:bg-yellow-100"
            title="현재 표를 엑셀(CSV)로 다운로드"
          >
            ⬇ 엑셀
          </button>
        </div>
      </div>

      {/* 랭킹 */}
      <ScrollHint className="border-[2px] border-[#0a0a0a] bg-white">
        <table className="w-full min-w-[620px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white select-none">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:bg-white/10" onClick={() => toggleSort("key")}>{view === "brand" ? "브랜드" : "지점"}{arrow("key")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">{view === "brand" ? "매장수" : "브랜드수"}</th>
              {view === "brand" && <th className="px-3 py-2 text-left">복종</th>}
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("s")}>매출(백만){arrow("s")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("g")}>이익(백만){arrow("g")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("gpm")}>이익률{arrow("gpm")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10" onClick={() => toggleSort("yoyPct")}>전년비{arrow("yoyPct")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <RankRow key={r.key} rank={i + 1} row={r} showCat={view === "brand"} left={isLeft(r)}
                open={expanded === r.key} onToggle={onToggleRow} subLabel={subLabel} />
            ))}
            {filtered.length === 0 && <tr><td colSpan={view === "brand" ? 8 : 7} className="px-3 py-8 text-center text-slate-400">결과 없음</td></tr>}
          </tbody>
        </table>
        {filtered.length > visible.length && (
          <div className="flex border-t-[2px] border-[#0a0a0a]">
            <button onClick={() => setLimit((l) => l + 20)}
              className="flex-1 bg-yellow-50 py-2.5 text-[12px] font-bold text-[#0a0a0a] hover:bg-yellow-100">
              더 보기 (+20)
            </button>
            <button onClick={() => setLimit(filtered.length)}
              className="border-l-[2px] border-[#0a0a0a] bg-white px-4 py-2.5 text-[12px] font-bold text-slate-600 hover:bg-slate-100">
              전체 ({filtered.length})
            </button>
          </div>
        )}
      </ScrollHint>
    </div>
  );
}

// 메모된 행 — expanded 토글 시 해당 행만 리렌더 (대용량 테이블 성능)
const RankRow = memo(function RankRow({
  rank, row, showCat, open, onToggle, subLabel, left,
}: {
  rank: number; row: OffRank; showCat: boolean; open: boolean;
  onToggle: (key: string) => void; subLabel: string; left?: boolean;
}) {
  const cols = showCat ? 8 : 7;
  return (
    <>
      <tr className={`border-t border-slate-100 ${row.closed ? "opacity-60" : "cursor-pointer hover:bg-yellow-50"} ${open ? "bg-yellow-50" : ""}`} onClick={() => { if (!row.closed) onToggle(row.key); }}>
        <td className="px-3 py-2 font-mono text-slate-400"><span className="mr-1 text-[9px]">{row.closed ? "" : open ? "▼" : "▶"}</span>{rank}</td>
        <td className="px-3 py-2 font-bold text-[#0a0a0a]">
          {row.key}
          {row.closed && <span className="ml-1.5 border border-rose-500 px-1 py-0 text-[9px] font-extrabold text-rose-600 align-middle">퇴점</span>}
          {!row.closed && left && <span className="ml-1.5 border border-amber-500 px-1 py-0 text-[9px] font-extrabold text-amber-600 align-middle" title="누적 매출 있으나 당월 빠짐">이탈</span>}
        </td>
        <td className="px-3 py-2 text-right font-mono text-slate-500">{row.subCount}</td>
        {showCat && <td className="px-3 py-2 text-slate-500">{displayCat(row.cat)}</td>}
        <td className="px-3 py-2 text-right font-mono font-bold">{row.closed ? "—" : mil(row.s)}</td>
        <td className="px-3 py-2 text-right font-mono">{row.closed ? "—" : mil(row.g)}</td>
        <td className="px-3 py-2 text-right font-mono text-slate-500">{row.closed ? "—" : `${row.gpm}%`}</td>
        <td className="px-3 py-2 text-right"><YoY pct={row.yoyPct} prev={row.ps} closed={row.closed} /></td>
      </tr>
      {open && row.bySub && (
        <tr className="bg-slate-50">
          <td></td>
          <td colSpan={cols - 1} className="px-3 py-2">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{subLabel}별 매출·이익 (백만, {row.bySub.length})</div>
            <div className="flex flex-col gap-1">
              {row.bySub.map((s) => {
                const pct = row.s ? (s.s / row.s) * 100 : 0;
                return (
                  <div key={s.key} className={`flex items-center gap-2 text-[11px] ${s.closed ? "opacity-60" : ""}`}>
                    <span className="w-32 shrink-0 font-bold text-[#0a0a0a]">
                      {s.key}
                      {s.closed && <span className="ml-1 border border-rose-500 px-1 py-0 text-[9px] font-extrabold text-rose-600 align-middle">퇴점</span>}
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-200"><div className="h-full bg-violet-400" style={{ width: `${pct}%` }} /></div>
                    <span className="w-10 text-right font-mono text-slate-400">{s.closed ? "" : `${pct.toFixed(0)}%`}</span>
                    <span className="w-24 text-right font-mono font-bold">{s.closed ? "—" : mil(s.s)}</span>
                    <span className="w-20 text-right font-mono text-slate-500">{s.closed ? "—" : mil(s.g)}</span>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

function BarSection({ title, barColor, rows, total, activeKey, onPick }: {
  title: string; barColor: string;
  rows: { key: string; label: string; s: number; ps: number; gpm: number; yoyPct: number }[];
  total: number; activeKey: string | null; onPick: (k: string) => void;
}) {
  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white">
      <div className="border-b-[2px] border-[#0a0a0a] bg-[#0a0a0a] px-3 py-2 text-[12px] font-bold text-white">{title}</div>
      <div className="divide-y divide-slate-100">
        {rows.map((d) => {
          const pct = total ? (d.s / total) * 100 : 0;
          const active = activeKey === d.key;
          return (
            <button key={d.key} onClick={() => onPick(d.key)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-[11px] text-left transition sm:gap-3 sm:text-[12px] ${active ? "bg-yellow-100" : "hover:bg-slate-50"}`}>
              <span className="w-16 shrink-0 truncate font-bold text-[#0a0a0a] sm:w-24">{d.label || "(미분류)"}</span>
              <div className="flex-1 min-w-[40px]"><div className="h-3 bg-slate-100"><div className="h-full" style={{ width: `${pct}%`, background: barColor }} /></div></div>
              <span className="hidden w-10 text-right font-mono text-slate-500 sm:inline">{pct.toFixed(0)}%</span>
              <span className="w-20 text-right font-mono font-bold sm:w-24">{mil(d.s)}</span>
              <span className="hidden w-14 text-right font-mono text-slate-500 sm:inline">GPM{d.gpm}</span>
              <span className="w-14 text-right sm:w-16"><YoY pct={d.yoyPct} prev={d.ps} /></span>
            </button>
          );
        })}
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
