"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import type { OnlineRank } from "@/lib/sales/queries";
import { downloadCsv } from "@/lib/sales/exportCsv";
import { isHiddenCat, displayCat, catRank } from "@/lib/sales/labels";
import { pillBtn, inputCompact } from "@/lib/tokens";
import ScrollHint from "@/components/ui/ScrollHint";
import UnitChip from "@/components/ui/UnitChip";
import StatusLegend from "@/components/ui/StatusLegend";

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
  cats: { cat: string; s: number; ps: number; yoyPct: number }[];
  periodLabel?: string;  // "온라인 매출" 라벨 접두 (기본: 당월)
  monthActive?: { brands: string[]; stores: string[] } | null;  // 당월 매출 있는 키 (누적 탭 이탈 판정)
}

const won = (n: number) => n.toLocaleString("ko-KR");
/** 억 단위 (소수1) */
const eok = (n: number) => (n / 1e8).toFixed(1);
/** 백만 단위 */
const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR");
function yoyBadge(pct: number, closed?: boolean) {
  if (closed) {
    return <span style={{ color: "#e53e3e", fontWeight: 700 }} title="전년 실적은 있으나 올해 매출 없음 (퇴점)">퇴점</span>;
  }
  const up = pct >= 0;
  return (
    <span className="whitespace-nowrap tabular-nums" style={{ color: up ? "#0d9e6e" : "#e53e3e", fontWeight: 700 }}>
      {up ? "▲" : "▼"}&nbsp;{Math.abs(pct).toFixed(1)}%
    </span>
  );
}

type SortKey = "key" | "s" | "ps" | "yoyPct";

export default function OnlineMonthTab(p: Props) {
  const [view, setView] = useState<"brand" | "store">("brand");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subLimit, setSubLimit] = useState(10);   // 드릴다운 하위 표시 개수
  const [sortKey, setSortKey] = useState<SortKey>("s");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [closedOnly, setClosedOnly] = useState(false);

  // 행 펼치기/접기 (펼칠 때 하위 표시 10개로 초기화)
  function toggleRow(key: string) {
    setExpanded((cur) => (cur === key ? null : key));
    setSubLimit(10);
  }

  const [leftOnly, setLeftOnly] = useState(false);

  const rows = view === "brand" ? p.brands : p.stores;
  // 이탈: 누적 매출 있으나 당월에 빠진 건 (완전퇴점 제외)
  const enableLeft = !!p.monthActive;
  const activeSet = useMemo(
    () => new Set(p.monthActive ? (view === "brand" ? p.monthActive.brands : p.monthActive.stores) : []),
    [p.monthActive, view],
  );
  const isLeft = useCallback(
    (r: OnlineRank) => enableLeft && !r.closed && r.s > 0 && !activeSet.has(r.key),
    [enableLeft, activeSet],
  );
  const closedCount = useMemo(() => rows.filter((r) => r.closed).length, [rows]);
  const leftCount = useMemo(() => rows.filter(isLeft).length, [rows, isLeft]);
  const filtered = useMemo(() => {
    let list = closedOnly ? rows.filter((r) => r.closed) : leftOnly ? rows.filter(isLeft) : [...rows];
    if (q) list = list.filter((r) => r.key.includes(q) || (r.cat ?? "").includes(q) || displayCat(r.cat).includes(q));
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "key") return a.key.localeCompare(b.key, "ko") * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return list;
  }, [rows, q, sortKey, sortDir, closedOnly, leftOnly, isLeft]);

  // 헤더 클릭: 같은 키면 방향 토글, 다른 키면 내림차순부터
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "key" ? "asc" : "desc"); }
    setExpanded(null);
  }
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  // 뷰 전환 시 펼침 초기화
  function switchView(v: "brand" | "store") { setView(v); setExpanded(null); }
  const subLabel = view === "brand" ? "지점" : "브랜드";

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard label={`${p.ym} ${p.periodLabel ?? "온라인 매출"}`} value={`${eok(p.total)}억`} sub={`${won(p.total)}원`} accent subSmOnly />
        <SummaryCard label={`전년 (${p.prevYm})`} value={`${eok(p.prevTotal)}억`} sub={`${won(p.prevTotal)}원`} subSmOnly />
        <SummaryCard label="전년대비" value={`${p.yoyPct >= 0 ? "+" : ""}${p.yoyPct}%`}
          sub={`${mil(p.total - p.prevTotal)}백만`} tone={p.yoyPct >= 0 ? "up" : "down"} />
      </div>

      {/* 채널별 요약 */}
      <div className="border-[2px] border-[#0a0a0a] bg-white">
        <div className="border-b-[2px] border-[#0a0a0a] bg-[#0a0a0a] px-3 py-2 text-[12px] font-bold text-white">
          채널별 매출 (백만 · {p.ym})
        </div>
        <div className="divide-y divide-slate-100">
          {p.channels.map((c) => {
            const pctOfTotal = p.total ? (c.s / p.total) * 100 : 0;
            return (
              <div key={c.channel} className="flex items-center gap-2 px-3 py-2 text-[11px] sm:gap-3 sm:text-[12px]">
                <span className="w-20 shrink-0 truncate font-bold text-[#0a0a0a] sm:w-32">{c.channel}</span>
                <div className="flex-1 min-w-[40px]">
                  <div className="h-3 bg-slate-100">
                    <div className="h-full bg-yellow-400" style={{ width: `${Math.max(pctOfTotal, 0)}%` }} />
                  </div>
                </div>
                <span className="hidden w-12 text-right font-mono text-slate-500 sm:inline">{pctOfTotal.toFixed(1)}%</span>
                <span className="w-20 text-right font-mono font-bold sm:w-24">{mil(c.s)}</span>
                <span className="w-14 text-right sm:w-20">{yoyBadge(c.yoyPct)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 복종별 요약 ("패션공통" 비노출) */}
      <div className="border-[2px] border-[#0a0a0a] bg-white">
        <div className="border-b-[2px] border-[#0a0a0a] bg-[#0a0a0a] px-3 py-2 text-[12px] font-bold text-white">
          복종별 매출 (백만 · {p.ym})
        </div>
        <div className="divide-y divide-slate-100">
          {p.cats.filter((c) => !isHiddenCat(c.cat)).sort((a, b) => catRank(a.cat) - catRank(b.cat)).map((c) => {
            const pctOfTotal = p.total ? (c.s / p.total) * 100 : 0;
            return (
              <div key={c.cat} className="flex items-center gap-2 px-3 py-2 text-[11px] sm:gap-3 sm:text-[12px]">
                <span className="w-20 shrink-0 truncate font-bold text-[#0a0a0a] sm:w-32">{displayCat(c.cat) || "(미분류)"}</span>
                <div className="flex-1 min-w-[40px]">
                  <div className="h-3 bg-slate-100">
                    <div className="h-full bg-cyan-400" style={{ width: `${Math.max(pctOfTotal, 0)}%` }} />
                  </div>
                </div>
                <span className="hidden w-12 text-right font-mono text-slate-500 sm:inline">{pctOfTotal.toFixed(1)}%</span>
                <span className="w-20 text-right font-mono font-bold sm:w-24">{mil(c.s)}</span>
                <span className="w-14 text-right sm:w-20">{yoyBadge(c.yoyPct)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 브랜드/지점 토글 + 검색 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["brand", "store"] as const).map((v) => (
            <button key={v} onClick={() => switchView(v)} className={pillBtn(view === v)}>
              {v === "brand" ? `브랜드 랭킹 (${p.brands.length})` : `지점별 집계 (${p.stores.length})`}
            </button>
          ))}
          {closedCount > 0 && (
            <button onClick={() => { setClosedOnly((c) => !c); setLeftOnly(false); setExpanded(null); }}
              className={`border-[2px] border-rose-500 px-3 py-1.5 text-[12px] font-bold transition ${closedOnly ? "bg-rose-500 text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white text-rose-600 hover:bg-rose-50"}`}
              title="전년 실적은 있으나 올해 매출 없는 항목만 보기">
              퇴점 {closedCount}
            </button>
          )}
          {leftCount > 0 && (
            <button onClick={() => { setLeftOnly((c) => !c); setClosedOnly(false); setExpanded(null); }}
              className={`border-[2px] border-amber-500 px-3 py-1.5 text-[12px] font-bold transition ${leftOnly ? "bg-amber-500 text-white shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white text-amber-600 hover:bg-amber-50"}`}
              title="누적 매출은 있으나 당월에 빠진 항목(이탈)만 보기">
              이탈 {leftCount}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={view === "brand" ? "브랜드/복종 검색" : "지점 검색"}
            className={inputCompact}
          />
          <button
            onClick={() => {
              const header = view === "brand"
                ? ["순위", "브랜드", "복종", "매출(백만)", "전년매출(백만)", "전년비%", "주력채널(백만)"]
                : ["순위", "지점", "매출(백만)", "전년매출(백만)", "전년비%", "주력채널(백만)"];
              const yoyCell = (r: OnlineRank) => r.closed ? "퇴점" : r.yoyPct;
              const m = (n: number) => Math.round(n / 1e6);
              const chCell = (r: OnlineRank) => r.byChannel.slice(0, 3).map((c) => `${c.channel}:${m(c.s)}`).join(" ");
              const body = filtered.map((r, i) => view === "brand"
                ? [i + 1, r.key, displayCat(r.cat), m(r.s), m(r.ps), yoyCell(r), chCell(r)]
                : [i + 1, r.key, m(r.s), m(r.ps), yoyCell(r), chCell(r)]);
              downloadCsv(`온라인_${p.ym}_${view === "brand" ? "브랜드" : "지점"}`, [header, ...body]);
            }}
            className="shrink-0 border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[12px] font-bold hover:bg-yellow-100"
            title="현재 표를 엑셀(CSV)로 다운로드"
          >
            ⬇ 엑셀
          </button>
        </div>
      </div>

      {/* 랭킹 테이블 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
        <UnitChip>매출 단위: 백만원</UnitChip>
        <span>요약 카드는 억 단위</span>
        <StatusLegend items={enableLeft ? ["closed", "left"] : ["closed"]} />
      </div>
      <ScrollHint className="border-[2px] border-[#0a0a0a] bg-white">
        <table className="w-full min-w-[420px] sm:min-w-[560px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white select-none">
            <tr>
              <th className="sticky left-0 z-[2] bg-[#0a0a0a] px-3 py-2 text-left w-10">#</th>
              <th className="sticky left-10 z-[2] bg-[#0a0a0a] px-3 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSort("key")}>
                {view === "brand" ? "브랜드" : "지점"}{arrow("key")}
              </th>
              {view === "brand" && <th className="hidden sm:table-cell px-3 py-2 text-left whitespace-nowrap">복종</th>}
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSort("s")}>
                {p.ym} 매출(백만){arrow("s")}
              </th>
              <th className="hidden sm:table-cell px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSort("ps")}>
                {p.prevYm}(백만){arrow("ps")}
              </th>
              <th className="px-3 py-2 text-right whitespace-nowrap cursor-pointer hover:bg-white/10" onClick={() => toggleSort("yoyPct")}>
                전년비{arrow("yoyPct")}
              </th>
              <th className="hidden sm:table-cell px-3 py-2 text-left whitespace-nowrap">주력 채널</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const open = expanded === r.key;
              const colCount = view === "brand" ? 7 : 6;
              return (
                <FragmentRow key={r.key}>
                  <tr
                    className={`group border-t border-slate-100 ${r.closed ? "opacity-60" : "cursor-pointer hover:bg-yellow-50"} ${open ? "bg-yellow-50" : ""}`}
                    onClick={() => { if (!r.closed) toggleRow(r.key); }}
                  >
                    <td className={`sticky left-0 z-[1] px-3 py-2 font-mono text-slate-400 group-hover:bg-yellow-50 ${open ? "bg-yellow-50" : "bg-white"}`}>
                      <span className="mr-1 inline-block text-[9px] text-slate-400">{r.closed ? "" : open ? "▼" : "▶"}</span>{i + 1}
                    </td>
                    <td className={`sticky left-10 z-[1] px-3 py-2 font-bold text-[#0a0a0a] group-hover:bg-yellow-50 ${open ? "bg-yellow-50" : "bg-white"}`}>
                      {r.key}
                      {r.closed && <span className="ml-1.5 border border-rose-500 px-1 py-0 text-[9px] font-extrabold text-rose-600 align-middle">퇴점</span>}
                      {!r.closed && isLeft(r) && <span className="ml-1.5 border border-amber-500 px-1 py-0 text-[9px] font-extrabold text-amber-600 align-middle" title="누적 매출 있으나 당월 빠짐">이탈</span>}
                    </td>
                    {view === "brand" && <td className="hidden sm:table-cell px-3 py-2 text-slate-500 whitespace-nowrap">{displayCat(r.cat)}</td>}
                    <td className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap">{r.closed ? "—" : mil(r.s)}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-right font-mono text-slate-500 whitespace-nowrap">{mil(r.ps)}</td>
                    <td className="px-3 py-2 text-right">{yoyBadge(r.yoyPct, r.closed)}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-[11px] text-slate-600">
                      {r.byChannel.slice(0, 3).map((c) => `${c.channel} ${mil(c.s)}백만`).join(" · ")}
                    </td>
                  </tr>
                  {open && r.bySub && r.bySub.length > 0 && (
                    <tr className="bg-slate-50">
                      <td></td>
                      <td colSpan={colCount - 1} className="px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          {subLabel}별 매출 (백만, {r.bySub.length})
                        </div>
                        <div className="flex flex-col gap-1">
                          {r.bySub.slice(0, subLimit).map((s) => {
                            const pct = r.s ? (s.s / r.s) * 100 : 0;
                            return (
                              <div key={s.key} className={`flex items-center gap-2 text-[11px] ${s.closed ? "opacity-60" : ""}`}>
                                <span className="w-32 shrink-0 font-bold text-[#0a0a0a]">
                                  {s.key}
                                  {s.closed && <span className="ml-1 border border-rose-500 px-1 py-0 text-[9px] font-extrabold text-rose-600 align-middle">퇴점</span>}
                                </span>
                                <div className="flex-1 h-2.5 bg-slate-200">
                                  <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-10 text-right font-mono text-slate-400">{s.closed ? "" : `${pct.toFixed(0)}%`}</span>
                                <span className="w-24 text-right font-mono font-bold">{s.closed ? "—" : mil(s.s)}</span>
                              </div>
                            );
                          })}
                          {r.bySub.length > subLimit && (
                            <button onClick={(e) => { e.stopPropagation(); setSubLimit((l) => l + 10); }}
                              className="mt-1 w-full border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                              더 보기 (+10) · {Math.min(subLimit, r.bySub.length)}/{r.bySub.length}
                            </button>
                          )}
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
      </ScrollHint>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, tone, subSmOnly }: {
  label: string; value: string; sub?: string; accent?: boolean; tone?: "up" | "down"; subSmOnly?: boolean;
}) {
  const color = tone === "up" ? "#0d9e6e" : tone === "down" ? "#e53e3e" : "#0a0a0a";
  return (
    <div className={`border-[2px] border-[#0a0a0a] p-3 overflow-hidden ${accent ? "bg-yellow-100" : "bg-white"}`}
      style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="text-[11px] font-bold text-slate-500 truncate">{label}</div>
      <div className="mt-1 font-mono text-[16px] sm:text-[20px] lg:text-[24px] font-extrabold leading-none tabular-nums truncate" style={{ color }}>{value}</div>
      {sub && <div className={`mt-1 text-[10px] text-slate-400 truncate ${subSmOnly ? "hidden sm:block" : ""}`}>{sub}</div>}
    </div>
  );
}
