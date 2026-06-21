"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  type LivingPopup, type WeekRow, type PopupStatus, type LivingSpace, type DailyMap,
  CHANNELS, POPUP_TYPES, PROMOS, LIVING_BRANDS, LIVING_STORES,
  popupStatus, STATUS_LABEL, weekIndexOf,
} from "@/lib/livingPopup";
import { createPopup, updatePopup, deletePopup, setDailySales, type PopupInput } from "../_actions";

type Tab = "calendar" | "list" | "analytics" | "availability";

const INP = "w-full border-[2px] border-[#0a0a0a] px-2 py-1.5 text-[12px] outline-none focus:bg-yellow-50";

const STATUS_STYLE: Record<PopupStatus, { bg: string; bd: string; tx: string }> = {
  done: { bg: "bg-emerald-50", bd: "border-emerald-500", tx: "text-emerald-700" },
  live: { bg: "bg-amber-50",   bd: "border-amber-500",   tx: "text-amber-700" },
  plan: { bg: "bg-sky-50",     bd: "border-sky-500",     tx: "text-sky-700" },
};

interface Draft extends PopupInput { id?: string; }

export default function LivingClient({ popups, weeks, year, canEdit, spaces, daily }: {
  popups: LivingPopup[]; weeks: WeekRow[]; year: number; canEdit: boolean;
  spaces: LivingSpace[]; daily: DailyMap;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("calendar");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  // 그리드 컬럼 = 기본 16개 브랜드(요청 순서) + 데이터에만 있는 추가 브랜드
  const brands = useMemo(() => {
    const base = [...LIVING_BRANDS] as string[];
    const extras = [...new Set(popups.map((p) => p.brand))]
      .filter((b) => !base.includes(b))
      .sort((a, b) => a.localeCompare(b, "ko"));
    return [...base, ...extras];
  }, [popups]);

  // 기존 연합명 목록 (편집창 자동완성용)
  const coalitions = useMemo(
    () => [...new Set(popups.map((p) => p.coalition?.trim()).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "ko")),
    [popups],
  );

  // (weekIndex|brand) → popups
  const byCell = useMemo(() => {
    const m = new Map<string, LivingPopup[]>();
    for (const p of popups) {
      const wi = weekIndexOf({ startDate: p.startDate }, weeks);
      const k = `${wi}|${p.brand}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(p);
    }
    return m;
  }, [popups, weeks]);

  function openNew(brand?: string, week?: WeekRow, store?: string, coalition?: string) {
    setEditing({
      brand: brand ?? brands[0] ?? "", store: store ?? "",
      startDate: week?.start ?? `${year}-01-07`, endDate: week?.end ?? `${year}-01-13`,
      channel: null, popupType: "팝업", promo: null, vendor: "", sales: null,
      coalition: coalition ?? "", year,
    });
  }
  function openEdit(p: LivingPopup) {
    setEditing({
      id: p.id, brand: p.brand, store: p.store, startDate: p.startDate, endDate: p.endDate,
      channel: p.channel, popupType: p.popupType, promo: p.promo, vendor: p.vendor ?? "",
      sales: p.sales, note: p.note, coalition: p.coalition ?? "", year,
    });
  }

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const res = editing.id ? await updatePopup(editing.id, editing) : await createPopup(editing);
      if (res.ok) { toast.success(editing.id ? "수정됨" : "추가됨"); setEditing(null); router.refresh(); }
      else toast.error(res.error);
    });
  }
  function remove() {
    if (!editing?.id) return;
    if (!confirm("이 팝업 일정을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await deletePopup(editing.id!);
      if (res.ok) { toast.success("삭제됨"); setEditing(null); router.refresh(); }
      else toast.error(res.error);
    });
  }

  function saveDaily(popupId: string, entries: { date: string; sales: number }[]) {
    startTransition(async () => {
      const res = await setDailySales(popupId, year, entries);
      if (res.ok) { toast.success(`일매출 저장 · 실적 ${res.total.toLocaleString()}백만`); setEditing(null); router.refresh(); }
      else toast.error(res.error);
    });
  }

  const tabs: [Tab, string][] = [["calendar", "캘린더"], ["analytics", "실적분석"], ["availability", "가용·제안"], ["list", "목록"]];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`border-[2px] border-[#0a0a0a] px-4 py-1.5 text-[12px] font-bold transition ${tab === k ? "bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-yellow-50"}`}>
              {label}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => openNew()}
            className="border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1.5 text-[12px] font-bold hover:bg-[#222]">
            + 팝업 추가
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
        <Legend cls="bg-emerald-500" label="실행(실적 입력)" />
        <Legend cls="bg-amber-500" label="진행 중" />
        <Legend cls="bg-sky-500" label="계획" />
        {canEdit && <span className="text-slate-400">· 셀 클릭 → 편집 · 빈 칸 클릭 → 추가</span>}
      </div>

      {tab === "calendar" && (
        <CalendarGrid weeks={weeks} brands={brands} byCell={byCell} canEdit={canEdit} year={year}
          onCell={(b, w) => canEdit && openNew(b, w)} onChip={openEdit} />
      )}
      {tab === "list" && <ListTab popups={popups} onRow={canEdit ? openEdit : undefined} />}
      {tab === "analytics" && <AnalyticsTab popups={popups} />}
      {tab === "availability" && (
        <AvailabilityTab popups={popups} weeks={weeks} spaces={spaces}
          onPropose={canEdit ? (store, w, coalition) => openNew(undefined, w, store, coalition) : undefined}
          onEdit={canEdit ? openEdit : undefined} />
      )}

      {editing && (
        <Editor draft={editing} setDraft={setEditing} onSave={save} onDelete={remove}
          onClose={() => setEditing(null)} pending={pending} coalitions={coalitions}
          daily={editing.id ? (daily[editing.id] ?? []) : []} onSaveDaily={saveDaily} canEdit={canEdit} />
      )}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${cls}`} />{label}</span>;
}

// ── 캘린더 그리드 ────────────────────────────────────────────
function reconcileOrder(saved: string[], all: string[]): string[] {
  const inAll = saved.filter((b) => all.includes(b));
  const extras = all.filter((b) => !inAll.includes(b));
  return [...inAll, ...extras];
}

function CalendarGrid({ weeks, brands, byCell, canEdit, onCell, onChip, year }: {
  weeks: WeekRow[]; brands: string[]; byCell: Map<string, LivingPopup[]>; canEdit: boolean;
  onCell: (brand: string, week: WeekRow) => void; onChip: (p: LivingPopup) => void; year: number;
}) {
  const todayWi = weekIndexOf({ startDate: new Date().toISOString().slice(0, 10) }, weeks);

  // 브랜드 컬럼 순서 — 드래그로 변경, localStorage에 저장
  const STORAGE = `living-brand-order-${year}`;
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  useEffect(() => {
    // 마운트 후 1회 외부 스토어(localStorage) 읽기 — 하이드레이션 불일치 방지 위해 effect에서 동기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const raw = localStorage.getItem(STORAGE); if (raw) setSavedOrder(JSON.parse(raw)); } catch {}
  }, [STORAGE]);
  const display = useMemo(() => reconcileOrder(savedOrder, brands), [savedOrder, brands]);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  function applyOrder(from: number, to: number) {
    if (from === to) return;
    const next = [...display];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setSavedOrder(next);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch {}
  }

  // 현재 주차를 화면 가운데로 스크롤 (1월1주차 아님)
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    const c = scrollRef.current, r = todayRowRef.current;
    if (c && r) c.scrollTop += r.getBoundingClientRect().top - c.getBoundingClientRect().top - c.clientHeight / 2 + r.clientHeight / 2;
  }, []);

  // 가로 이동바를 표 위쪽에 — 상단 더미 스크롤바와 본문 스크롤 동기화
  const topRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const tableW = 120 + display.length * 120;
  function syncFrom(src: "top" | "main") {
    if (lock.current) { lock.current = false; return; }
    const t = topRef.current, c = scrollRef.current;
    if (!t || !c) return;
    lock.current = true;
    if (src === "top") c.scrollLeft = t.scrollLeft; else t.scrollLeft = c.scrollLeft;
  }

  return (
    <div>
    <div ref={topRef} onScroll={() => syncFrom("top")}
      className="overflow-x-auto overflow-y-hidden border-x-[2px] border-t-[2px] border-[#0a0a0a] bg-white">
      <div style={{ width: tableW, height: 1 }} />
    </div>
    <div ref={scrollRef} onScroll={() => syncFrom("main")} className="overflow-auto border-[2px] border-[#0a0a0a] bg-white" style={{ maxHeight: "70vh" }}>
      <table className="border-collapse text-[11px]" style={{ minWidth: tableW }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#0a0a0a] text-white">
            <th className="sticky left-0 z-20 bg-[#0a0a0a] px-2 py-2 text-left w-[110px]">주차{canEdit && <span className="ml-1 font-normal text-[8px] text-slate-400">⠿ 헤더 드래그로 이동</span>}</th>
            {display.map((b, i) => (
              <th key={b} draggable={canEdit}
                onDragStart={() => { dragFrom.current = i; }}
                onDragOver={(e) => { if (dragFrom.current != null) { e.preventDefault(); setDragOver(i); } }}
                onDrop={() => { if (dragFrom.current != null) applyOrder(dragFrom.current, i); dragFrom.current = null; setDragOver(null); }}
                onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}
                className={`px-2 py-2 text-center min-w-[120px] font-bold ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragOver === i ? "bg-yellow-600" : ""}`}>
                {canEdit && <span className="mr-0.5 opacity-50">⠿</span>}{b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.index} ref={w.index === todayWi ? todayRowRef : undefined} className={`border-t border-slate-200 ${w.index === todayWi ? "bg-yellow-50" : ""}`}>
              <td className="sticky left-0 z-[5] bg-white px-2 py-1.5 border-r border-slate-200">
                <div className="font-bold text-[#0a0a0a]">{w.label}{w.index === todayWi && <span className="ml-1 text-[9px] text-rose-600">오늘</span>}</div>
                <div className="text-[9px] text-slate-400">{w.rangeText}</div>
              </td>
              {display.map((b) => {
                const list = byCell.get(`${w.index}|${b}`) ?? [];
                return (
                  <td key={b} className={`align-top px-1 py-1 border-r border-slate-100 ${canEdit ? "cursor-pointer hover:bg-slate-50" : ""}`}
                    onClick={(e) => { if (e.target === e.currentTarget) onCell(b, w); }}>
                    {list.length === 0 && canEdit && <div className="h-5 text-center text-slate-200">+</div>}
                    <div className="flex flex-col gap-1">
                      {list.map((p) => {
                        const st = popupStatus(p), s = STATUS_STYLE[st];
                        const coalit = p.coalition?.trim();
                        return (
                          <button key={p.id} onClick={() => onChip(p)}
                            className={`w-full text-left rounded px-1.5 py-1 ${coalit ? "border-[1.5px] border-[#185FA5] bg-sky-50" : `border ${s.bd} ${s.bg}`}`}>
                            {coalit && (
                              <div className="flex items-center gap-0.5 text-[8px] font-bold text-[#185FA5] truncate mb-0.5">
                                <span className="leading-none">⛬</span><span className="truncate">{coalit}</span>
                              </div>
                            )}
                            <div className={`font-bold ${coalit ? "text-[#0C447C]" : s.tx} flex items-center justify-between gap-1`}>
                              <span className="truncate">{p.store}</span>
                              {p.sales != null
                                ? <span className="shrink-0 font-mono text-[10px]">{p.sales}</span>
                                : <span className="shrink-0 text-[8px] opacity-70">{STATUS_LABEL[st]}</span>}
                            </div>
                            {p.vendor && <div className={`text-[9px] ${coalit ? "text-[#185FA5]" : s.tx} opacity-70 truncate`}>{p.vendor}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ── 목록 탭 ─────────────────────────────────────────────────
function ListTab({ popups, onRow }: { popups: LivingPopup[]; onRow?: (p: LivingPopup) => void }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const f = q ? popups.filter((p) => (p.brand + p.store + (p.vendor ?? "")).includes(q)) : popups;
    return [...f].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [popups, q]);
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="브랜드/지점/벤더 검색"
        className="border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] focus:outline-none focus:bg-yellow-50 w-full max-w-[280px]" />
      <div className="overflow-x-auto border-[2px] border-[#0a0a0a] bg-white">
        <table className="w-full min-w-[680px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white">
            <tr>
              {["기간", "브랜드", "지점", "벤더", "실적(백만)", "상태"].map((h) => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const st = popupStatus(p), s = STATUS_STYLE[st];
              return (
                <tr key={p.id} onClick={() => onRow?.(p)}
                  className={`border-t border-slate-100 ${onRow ? "cursor-pointer hover:bg-yellow-50" : ""}`}>
                  <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{p.startDate.slice(5)}~{p.endDate.slice(5)}</td>
                  <td className="px-3 py-2 font-bold text-[#0a0a0a]">{p.brand}</td>
                  <td className="px-3 py-2">{p.store}</td>
                  <td className="px-3 py-2">{p.vendor ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{p.sales != null ? p.sales.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2"><span className={`inline-block border ${s.bd} ${s.bg} ${s.tx} rounded px-1.5 py-0.5 text-[10px] font-bold`}>{STATUS_LABEL[st]}</span></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">데이터 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 실적분석 탭 ─────────────────────────────────────────────
function AnalyticsTab({ popups }: { popups: LivingPopup[] }) {
  const agg = useMemo(() => {
    const sum = (key: (p: LivingPopup) => string) => {
      const m = new Map<string, { cnt: number; sales: number; done: number }>();
      for (const p of popups) {
        const k = key(p); const e = m.get(k) ?? { cnt: 0, sales: 0, done: 0 };
        e.cnt++; if (p.sales != null) { e.sales += p.sales; e.done++; }
        m.set(k, e);
      }
      return [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.sales - a.sales);
    };
    const totalSales = popups.reduce((t, p) => t + (p.sales ?? 0), 0);
    const monthMap = new Map<string, number>();
    for (const p of popups) if (p.sales != null) {
      const m = p.startDate.slice(0, 7); monthMap.set(m, (monthMap.get(m) ?? 0) + p.sales);
    }
    return { byBrand: sum((p) => p.brand), byStore: sum((p) => p.store),
      byMonth: [...monthMap.entries()].sort(), totalSales };
  }, [popups]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="총 팝업" value={`${popups.length}건`} />
        <Stat label="실적입력" value={`${popups.filter((p) => p.sales != null).length}건`} />
        <Stat label="총 실적(백만)" value={agg.totalSales.toLocaleString()} accent />
        <Stat label="평균 실적" value={agg.byBrand.length ? Math.round(agg.totalSales / Math.max(1, popups.filter((p) => p.sales != null).length)).toLocaleString() : "—"} />
      </div>
      <RankTable title="브랜드별 실적" rows={agg.byBrand} />
      <RankTable title="지점별 실적" rows={agg.byStore} />
      <div className="border-[2px] border-[#0a0a0a] bg-white">
        <div className="bg-[#0a0a0a] text-white px-3 py-2 text-[12px] font-bold">월별 실적 (백만)</div>
        <div className="divide-y divide-slate-100">
          {agg.byMonth.map(([m, v]) => {
            const max = Math.max(...agg.byMonth.map((x) => x[1]), 1);
            return (
              <div key={m} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                <span className="w-16 font-bold">{m.slice(5)}월</span>
                <div className="flex-1 h-3 bg-slate-100"><div className="h-full bg-yellow-400" style={{ width: `${(v / max) * 100}%` }} /></div>
                <span className="w-16 text-right font-mono font-bold">{v.toLocaleString()}</span>
              </div>
            );
          })}
          {agg.byMonth.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-slate-400">실적 데이터 없음</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border-[2px] border-[#0a0a0a] p-3 ${accent ? "bg-yellow-100" : "bg-white"}`} style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-[20px] font-extrabold leading-none">{value}</div>
    </div>
  );
}

function RankTable({ title, rows }: { title: string; rows: { k: string; cnt: number; sales: number; done: number }[] }) {
  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white">
      <div className="bg-[#0a0a0a] text-white px-3 py-2 text-[12px] font-bold">{title}</div>
      <table className="w-full text-[12px]">
        <thead><tr className="bg-[#F1ECDB] border-b-[2px] border-[#0a0a0a]">
          <th className="px-3 py-1.5 text-left">#</th><th className="px-3 py-1.5 text-left">{title.slice(0, 2)}</th>
          <th className="px-3 py-1.5 text-right">팝업</th><th className="px-3 py-1.5 text-right">실적입력</th><th className="px-3 py-1.5 text-right">실적(백만)</th>
        </tr></thead>
        <tbody>
          {rows.slice(0, 15).map((r, i) => (
            <tr key={r.k} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-mono text-slate-400">{i + 1}</td>
              <td className="px-3 py-1.5 font-bold">{r.k}</td>
              <td className="px-3 py-1.5 text-right font-mono">{r.cnt}</td>
              <td className="px-3 py-1.5 text-right font-mono text-slate-500">{r.done}</td>
              <td className="px-3 py-1.5 text-right font-mono font-bold">{r.sales.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 가용·제안 탭 (지점 × 주차 히트맵) ──────────────────────────
type CellItem =
  | { kind: "single"; p: LivingPopup }
  | { kind: "coalition"; name: string; members: LivingPopup[] };

function groupCell(list: LivingPopup[]): CellItem[] {
  const out: CellItem[] = [];
  const idx = new Map<string, number>();
  for (const p of list) {
    const c = p.coalition?.trim();
    if (c) {
      const at = idx.get(c);
      if (at != null) (out[at] as { members: LivingPopup[] }).members.push(p);
      else { idx.set(c, out.length); out.push({ kind: "coalition", name: c, members: [p] }); }
    } else out.push({ kind: "single", p });
  }
  return out.map((it) => (it.kind === "coalition" && it.members.length === 1 ? { kind: "single" as const, p: it.members[0] } : it));
}

function AvailabilityTab({ popups, weeks, spaces, onPropose, onEdit }: {
  popups: LivingPopup[]; weeks: WeekRow[]; spaces: LivingSpace[];
  onPropose?: (store: string, week: WeekRow, coalition?: string) => void;
  onEdit?: (p: LivingPopup) => void;
}) {
  const todayWi = weekIndexOf({ startDate: new Date().toISOString().slice(0, 10) }, weeks);
  const future = useMemo(() => weeks.filter((w) => w.index >= todayWi), [weeks, todayWi]);

  // 지점 목록 = 공간 DB 지점 ∪ 일정에 등장한 지점
  const stores = useMemo(() => {
    const set = new Set<string>(spaces.map((s) => s.store));
    popups.forEach((p) => set.add(p.store));
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [spaces, popups]);

  // 지점 → 공간정보(층/장소/평수) 요약
  const spaceByStore = useMemo(() => {
    const m = new Map<string, LivingSpace[]>();
    for (const s of spaces) (m.get(s.store) ?? m.set(s.store, []).get(s.store)!).push(s);
    return m;
  }, [spaces]);

  // (store|wi) → 예약 팝업
  const booked = useMemo(() => {
    const m = new Map<string, LivingPopup[]>();
    for (const p of popups) {
      const wi = weekIndexOf({ startDate: p.startDate }, weeks);
      const k = `${p.store}|${wi}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(p);
    }
    return m;
  }, [popups, weeks]);

  const emptyCount = stores.length * future.length - [...booked.entries()].filter(([k]) => {
    const wi = Number(k.split("|")[1]); return wi >= todayWi;
  }).length;

  function spaceText(store: string) {
    const list = spaceByStore.get(store);
    if (!list?.length) return null;
    return list.map((s) => [s.floor, s.place, s.areaPyeong ? `${s.areaPyeong}평` : null].filter(Boolean).join(" ")).filter(Boolean).join(" / ");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <span>지점 × 주차 가용 현황 · <b className="text-sky-700">빈 칸 클릭 → 그 자리에 업체 제안/배치</b></span>
        <span className="text-slate-400">앞으로 빈 슬롯 약 {Math.max(emptyCount, 0)}개</span>
        {spaces.length === 0 && <span className="text-amber-600">· 공간 DB(층/장소/평수) 미입력 — 채우면 제안 시 함께 표시됩니다</span>}
      </div>
      <div className="overflow-auto border-[2px] border-[#0a0a0a] bg-white" style={{ maxHeight: "70vh" }}>
        <table className="border-collapse text-[11px]" style={{ minWidth: 180 + future.length * 96 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0a0a0a] text-white">
              <th className="sticky left-0 z-20 bg-[#0a0a0a] px-2 py-2 text-left w-[160px]">지점</th>
              {future.map((w) => <th key={w.index} className="px-1 py-2 text-center min-w-[92px] font-bold whitespace-nowrap">{w.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const sp = spaceText(store);
              return (
                <tr key={store} className="border-t border-slate-200">
                  <td className="sticky left-0 z-[5] bg-white px-2 py-1.5 border-r border-slate-200">
                    <div className="font-bold text-[#0a0a0a]">{store}</div>
                    {sp && <div className="text-[9px] text-slate-400 leading-tight">{sp}</div>}
                  </td>
                  {future.map((w) => {
                    const list = booked.get(`${store}|${w.index}`) ?? [];
                    if (list.length > 0) {
                      return (
                        <td key={w.index} className="align-top px-1 py-1 border-r border-slate-100">
                          {groupCell(list).map((it) => {
                            if (it.kind === "coalition") {
                              const sum = it.members.reduce((t, m) => t + (m.sales ?? 0), 0);
                              const hasSales = it.members.some((m) => m.sales != null);
                              return (
                                <div key={it.name} className="mb-0.5 rounded border-[1.5px] border-[#185FA5] bg-sky-50 px-1 py-0.5">
                                  <div className="flex items-center justify-between gap-1 text-[9px] font-bold text-[#0C447C]">
                                    <span className="truncate"><span className="mr-0.5">⛬</span>{it.name}</span>
                                    <span className="shrink-0 rounded bg-[#185FA5] px-1 text-white">{it.members.length}사</span>
                                  </div>
                                  <div className="mt-0.5 flex flex-col gap-0.5">
                                    {it.members.map((m) => (
                                      <button key={m.id} onClick={() => onEdit?.(m)} disabled={!onEdit}
                                        className="flex items-center justify-between gap-1 rounded px-1 text-[10px] text-[#0C447C] hover:bg-sky-100 disabled:cursor-default disabled:hover:bg-transparent">
                                        <span className="truncate font-bold">{m.brand}</span>
                                        <span className="shrink-0 font-mono">{m.sales != null ? m.sales : "·"}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <div className="mt-0.5 flex items-center justify-between border-t border-sky-200 pt-0.5 text-[9px]">
                                    <span className="text-[#185FA5]">{hasSales ? "합산" : "계획"}</span>
                                    <span className="font-mono font-bold text-[#0C447C]">{hasSales ? sum.toLocaleString() : "—"}</span>
                                  </div>
                                  {onPropose && (
                                    <button onClick={() => onPropose(store, w, it.name)}
                                      className="mt-0.5 w-full rounded border border-dashed border-[#85B7EB] text-[9px] text-[#185FA5] hover:bg-sky-100">+ 브랜드</button>
                                  )}
                                </div>
                              );
                            }
                            const p = it.p, s = STATUS_STYLE[popupStatus(p)];
                            return (
                              <button key={p.id} onClick={() => onEdit?.(p)} disabled={!onEdit}
                                className={`mb-0.5 block w-full truncate rounded border ${s.bd} ${s.bg} ${s.tx} px-1 py-0.5 text-left font-bold disabled:cursor-default`}>{p.brand}</button>
                            );
                          })}
                        </td>
                      );
                    }
                    return (
                      <td key={w.index} className={`px-1 py-1 border-r border-slate-100 text-center ${onPropose ? "cursor-pointer hover:bg-sky-50" : ""}`}
                        onClick={() => onPropose?.(store, w)}>
                        <span className="text-[10px] text-slate-300">{onPropose ? "+ 제안" : "·"}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {stores.length === 0 && <tr><td colSpan={future.length + 1} className="px-3 py-8 text-center text-slate-400">지점 데이터 없음 — 일정 등록 또는 공간 DB 입력</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 편집 패널 ───────────────────────────────────────────────
function Editor({ draft, setDraft, onSave, onDelete, onClose, pending, daily, onSaveDaily, canEdit, coalitions }: {
  draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onDelete: () => void; onClose: () => void; pending: boolean;
  daily: { date: string; sales: number }[]; onSaveDaily: (popupId: string, entries: { date: string; sales: number }[]) => void;
  canEdit: boolean; coalitions: string[];
}) {
  const st = popupStatus({ startDate: draft.startDate, endDate: draft.endDate });
  const s = STATUS_STYLE[st];
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const salesLocked = st !== "done";
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="w-full max-w-[640px] my-auto border-[2px] border-[#0a0a0a] bg-white p-4" style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[15px] font-bold">{draft.id ? "팝업 편집" : "새 팝업"}</div>
        <span className={`border ${s.bd} ${s.bg} ${s.tx} rounded px-2 py-0.5 text-[12px] font-bold`}>{STATUS_LABEL[st]}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="브랜드">
          <input list="lp-brands" value={draft.brand} onChange={(e) => set({ brand: e.target.value })} className={INP} />
          <datalist id="lp-brands">{LIVING_BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
        </Field>
        <Field label="지점">
          <input list="lp-stores" value={draft.store} onChange={(e) => set({ store: e.target.value })} className={INP} />
          <datalist id="lp-stores">{LIVING_STORES.map((s2) => <option key={s2} value={s2} />)}</datalist>
        </Field>
        <Field label="시작일"><input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} className={INP} /></Field>
        <Field label="종료일"><input type="date" value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} className={INP} /></Field>
        <Field label="채널">
          <select value={draft.channel ?? ""} onChange={(e) => set({ channel: e.target.value || null })} className={INP}>
            <option value="">미정</option>{CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="유형">
          <select value={draft.popupType ?? ""} onChange={(e) => set({ popupType: e.target.value || null })} className={INP}>
            {POPUP_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="벤더(운영사)"><input value={draft.vendor ?? ""} onChange={(e) => set({ vendor: e.target.value })} placeholder="예: SCK, 명보, 락앤락" className={INP} /></Field>
        <Field label="행사">
          <select value={draft.promo ?? ""} onChange={(e) => set({ promo: e.target.value || null })} className={INP}>
            <option value="">없음</option>{PROMOS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <div className="col-span-2">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">연합 주제전명 <span className="font-normal text-slate-400">· 같은 지점·주차에 2개 이상 브랜드를 합동으로 묶을 때 동일 이름 입력</span></label>
          <input list="lp-coalitions" value={draft.coalition ?? ""} onChange={(e) => set({ coalition: e.target.value })}
            placeholder="예: 리빙위크 연합 (단독이면 비워두기)" className={INP} />
          <datalist id="lp-coalitions">{coalitions.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <Field label={`실적 매출(백만)${salesLocked ? " · 실행 후 입력" : ""}`}>
          <input type="number" value={draft.sales ?? ""} disabled={salesLocked}
            onChange={(e) => set({ sales: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder={salesLocked ? "계획 단계" : "예: 31"} className={`${INP} ${salesLocked ? "opacity-50" : ""}`} />
        </Field>
        <Field label="메모"><input value={draft.note ?? ""} onChange={(e) => set({ note: e.target.value })} className={INP} /></Field>
      </div>

      {draft.id && canEdit && (
        <DailySection popupId={draft.id} startDate={draft.startDate} endDate={draft.endDate}
          daily={daily} pending={pending} onSave={onSaveDaily} />
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={onSave} disabled={pending}
          className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-4 py-1.5 text-[13px] font-bold hover:bg-yellow-400 disabled:opacity-50">
          {pending ? "저장 중…" : "저장"}
        </button>
        {draft.id && <button onClick={onDelete} disabled={pending} className="border-[2px] border-rose-500 text-rose-600 px-3 py-1.5 text-[13px] font-bold hover:bg-rose-50">삭제</button>}
        <button onClick={onClose} className="ml-auto border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[13px] font-bold hover:bg-slate-50">닫기</button>
      </div>
    </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── 일매출 입력 (#2) — 날짜별 매출 → 합계 자동 = 실적 ───────────
function datesBetween(start: string, end: string, cap = 62): string[] {
  const out: string[] = [];
  const d = new Date(start); const e = new Date(end);
  while (d <= e && out.length < cap) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function DailySection({ popupId, startDate, endDate, daily, pending, onSave }: {
  popupId: string; startDate: string; endDate: string;
  daily: { date: string; sales: number }[]; pending: boolean;
  onSave: (popupId: string, entries: { date: string; sales: number }[]) => void;
}) {
  const dates = useMemo(() => datesBetween(startDate, endDate), [startDate, endDate]);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const d of daily) m[d.date] = String(d.sales);
    return m;
  });
  const totalWon = dates.reduce((t, d) => t + (Number(vals[d]) || 0), 0);
  return (
    <div className="mt-4 border-[2px] border-[#0a0a0a] bg-slate-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-bold">일매출 입력 <span className="font-normal text-slate-500">(원 단위 — 합계가 실적으로 자동 반영)</span></div>
        <div className="text-[12px] font-extrabold">합계 {Math.round(totalWon / 1e6).toLocaleString()}백만</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto">
        {dates.map((d) => (
          <label key={d} className="flex items-center gap-1 text-[11px]">
            <span className="w-12 shrink-0 text-slate-500">{d.slice(5)}</span>
            <input type="number" value={vals[d] ?? ""} onChange={(e) => setVals({ ...vals, [d]: e.target.value })}
              placeholder="0" className="w-full border border-slate-300 px-1.5 py-1 text-right font-mono focus:outline-none focus:border-[#0a0a0a]" />
          </label>
        ))}
      </div>
      <button onClick={() => onSave(popupId, dates.map((d) => ({ date: d, sales: Number(vals[d]) || 0 })))} disabled={pending}
        className="mt-2 border-[2px] border-[#0a0a0a] bg-emerald-300 px-3 py-1 text-[12px] font-bold hover:bg-emerald-400 disabled:opacity-50">
        {pending ? "저장 중…" : "일매출 저장 → 실적 자동 계산"}
      </button>
    </div>
  );
}

