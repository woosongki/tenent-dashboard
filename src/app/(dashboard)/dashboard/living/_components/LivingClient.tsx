"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  type LivingPopup, type WeekRow, type PopupStatus, type LivingSpace, type DailyMap,
  CHANNELS, POPUP_TYPES, PROMOS, LIVING_BRANDS, LIVING_STORES,
  popupStatus, STATUS_LABEL, weekIndexOf,
} from "@/lib/livingPopup";
import { createPopup, updatePopup, deletePopup, bulkCreatePopups, setDailySales, type PopupInput } from "../_actions";

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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // 그리드 컬럼 = 기본 16개 브랜드(요청 순서) + 데이터에만 있는 추가 브랜드
  const brands = useMemo(() => {
    const base = [...LIVING_BRANDS] as string[];
    const extras = [...new Set(popups.map((p) => p.brand))]
      .filter((b) => !base.includes(b))
      .sort((a, b) => a.localeCompare(b, "ko"));
    return [...base, ...extras];
  }, [popups]);

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

  function openNew(brand?: string, week?: WeekRow, store?: string) {
    setEditing({
      brand: brand ?? brands[0] ?? "", store: store ?? "",
      startDate: week?.start ?? `${year}-01-07`, endDate: week?.end ?? `${year}-01-13`,
      channel: null, popupType: "팝업", promo: null, vendor: "", sales: null, year,
    });
  }
  function openEdit(p: LivingPopup) {
    setEditing({
      id: p.id, brand: p.brand, store: p.store, startDate: p.startDate, endDate: p.endDate,
      channel: p.channel, popupType: p.popupType, promo: p.promo, vendor: p.vendor ?? "",
      sales: p.sales, note: p.note, year,
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

  function bulkSave(rows: PopupInput[], onDone: () => void) {
    startTransition(async () => {
      const res = await bulkCreatePopups(rows.map((r) => ({ ...r, year })));
      if (res.ok) { toast.success(`${res.count}건 일괄 등록됨`); setBulkOpen(false); onDone(); router.refresh(); }
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

  const tabs: [Tab, string][] = [["calendar", "캘린더"], ["list", "목록"], ["analytics", "실적분석"], ["availability", "가용·제안"]];

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
          <div className="flex gap-1.5">
            <button onClick={() => setBulkOpen(true)}
              className="border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[12px] font-bold hover:bg-yellow-100">
              ⇪ 일괄 등록
            </button>
            <button onClick={() => openNew()}
              className="border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1.5 text-[12px] font-bold hover:bg-[#222]">
              + 팝업 추가
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
        <Legend cls="bg-emerald-500" label="실행(실적 입력)" />
        <Legend cls="bg-amber-500" label="진행 중" />
        <Legend cls="bg-sky-500" label="계획" />
        {canEdit && <span className="text-slate-400">· 셀 클릭 → 편집 · 빈 칸 클릭 → 추가</span>}
      </div>

      {tab === "calendar" && (
        <CalendarGrid weeks={weeks} brands={brands} byCell={byCell} canEdit={canEdit}
          onCell={(b, w) => canEdit && openNew(b, w)} onChip={openEdit} />
      )}
      {tab === "list" && <ListTab popups={popups} onRow={canEdit ? openEdit : undefined} />}
      {tab === "analytics" && <AnalyticsTab popups={popups} />}
      {tab === "availability" && (
        <AvailabilityTab popups={popups} weeks={weeks} spaces={spaces}
          onPropose={canEdit ? (store, w) => openNew(undefined, w, store) : undefined} />
      )}

      {bulkOpen && canEdit && (
        <BulkPanel pending={pending} onClose={() => setBulkOpen(false)} onSave={bulkSave} />
      )}

      {editing && (
        <Editor draft={editing} setDraft={setEditing} onSave={save} onDelete={remove}
          onClose={() => setEditing(null)} pending={pending}
          daily={editing.id ? (daily[editing.id] ?? []) : []} onSaveDaily={saveDaily} canEdit={canEdit} />
      )}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${cls}`} />{label}</span>;
}

// ── 캘린더 그리드 ────────────────────────────────────────────
function CalendarGrid({ weeks, brands, byCell, canEdit, onCell, onChip }: {
  weeks: WeekRow[]; brands: string[]; byCell: Map<string, LivingPopup[]>; canEdit: boolean;
  onCell: (brand: string, week: WeekRow) => void; onChip: (p: LivingPopup) => void;
}) {
  const todayWi = weekIndexOf({ startDate: new Date().toISOString().slice(0, 10) }, weeks);
  return (
    <div className="overflow-auto border-[2px] border-[#0a0a0a] bg-white" style={{ maxHeight: "70vh" }}>
      <table className="border-collapse text-[11px]" style={{ minWidth: 120 + brands.length * 120 }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#0a0a0a] text-white">
            <th className="sticky left-0 z-20 bg-[#0a0a0a] px-2 py-2 text-left w-[110px]">주차</th>
            {brands.map((b) => <th key={b} className="px-2 py-2 text-center min-w-[120px] font-bold">{b}</th>)}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.index} className={`border-t border-slate-200 ${w.index === todayWi ? "bg-yellow-50" : ""}`}>
              <td className="sticky left-0 z-[5] bg-white px-2 py-1.5 border-r border-slate-200">
                <div className="font-bold text-[#0a0a0a]">{w.label}{w.index === todayWi && <span className="ml-1 text-[9px] text-rose-600">오늘</span>}</div>
                <div className="text-[9px] text-slate-400">{w.rangeText}</div>
              </td>
              {brands.map((b) => {
                const list = byCell.get(`${w.index}|${b}`) ?? [];
                return (
                  <td key={b} className={`align-top px-1 py-1 border-r border-slate-100 ${canEdit ? "cursor-pointer hover:bg-slate-50" : ""}`}
                    onClick={(e) => { if (e.target === e.currentTarget) onCell(b, w); }}>
                    {list.length === 0 && canEdit && <div className="h-5 text-center text-slate-200">+</div>}
                    <div className="flex flex-col gap-1">
                      {list.map((p) => {
                        const st = popupStatus(p), s = STATUS_STYLE[st];
                        return (
                          <button key={p.id} onClick={() => onChip(p)}
                            className={`w-full text-left border ${s.bd} ${s.bg} rounded px-1.5 py-1`}>
                            <div className={`font-bold ${s.tx} flex items-center justify-between gap-1`}>
                              <span className="truncate">{p.store}</span>
                              {p.sales != null
                                ? <span className="shrink-0 font-mono text-[10px]">{p.sales}</span>
                                : <span className="shrink-0 text-[8px] opacity-70">{STATUS_LABEL[st]}</span>}
                            </div>
                            {p.vendor && <div className={`text-[9px] ${s.tx} opacity-70 truncate`}>{p.vendor}</div>}
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
              {["기간", "브랜드", "지점", "채널", "유형", "행사", "벤더", "실적(백만)", "상태"].map((h) => (
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
                  <td className="px-3 py-2 text-slate-500">{p.channel ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{p.popupType ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{p.promo ?? "—"}</td>
                  <td className="px-3 py-2">{p.vendor ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{p.sales != null ? p.sales.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2"><span className={`inline-block border ${s.bd} ${s.bg} ${s.tx} rounded px-1.5 py-0.5 text-[10px] font-bold`}>{STATUS_LABEL[st]}</span></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">데이터 없음</td></tr>}
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
function AvailabilityTab({ popups, weeks, spaces, onPropose }: {
  popups: LivingPopup[]; weeks: WeekRow[]; spaces: LivingSpace[];
  onPropose?: (store: string, week: WeekRow) => void;
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
                          {list.map((p) => {
                            const s = STATUS_STYLE[popupStatus(p)];
                            return <div key={p.id} className={`mb-0.5 rounded border ${s.bd} ${s.bg} ${s.tx} px-1 py-0.5 font-bold truncate`}>{p.brand}</div>;
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
function Editor({ draft, setDraft, onSave, onDelete, onClose, pending, daily, onSaveDaily, canEdit }: {
  draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onDelete: () => void; onClose: () => void; pending: boolean;
  daily: { date: string; sales: number }[]; onSaveDaily: (popupId: string, entries: { date: string; sales: number }[]) => void; canEdit: boolean;
}) {
  const st = popupStatus({ startDate: draft.startDate, endDate: draft.endDate });
  const s = STATUS_STYLE[st];
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const salesLocked = st !== "done";

  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white p-4" style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}>
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

// ── 일괄 등록 (#3) — 붙여넣기 → 다건 등록 ─────────────────────
function normDate(s: string, year: number): string {
  const t = s.trim().replace(/[./]/g, "-");
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})-(\d{1,2})$/);
  if (m) return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}
function BulkPanel({ pending, onClose, onSave }: {
  pending: boolean; onClose: () => void; onSave: (rows: PopupInput[], onDone: () => void) => void;
}) {
  const [text, setText] = useState("");
  const year = new Date().getFullYear();
  const parsed = useMemo(() => {
    const rows: PopupInput[] = []; const errs: string[] = [];
    text.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const c = line.split(/\t|,/).map((x) => x.trim());
      const [brand, store, start, end, channel, vendor] = c;
      const sd = normDate(start ?? "", year), ed = normDate(end ?? "", year);
      if (!brand || !store || !sd || !ed) { errs.push(`${i + 1}행: 브랜드/지점/시작/종료 확인`); return; }
      rows.push({ brand, store, startDate: sd, endDate: ed, channel: channel || null, vendor: vendor || null, popupType: "팝업", year });
    });
    return { rows, errs };
  }, [text, year]);

  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white p-4" style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[15px] font-bold">분기·반기 일괄 등록</div>
        <button onClick={onClose} className="text-[12px] text-slate-500 underline">닫기</button>
      </div>
      <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
        엑셀/시트에서 복사해 붙여넣으세요. 한 줄 = 한 팝업. 열 순서(탭 또는 콤마 구분):<br />
        <code className="text-[10px] bg-slate-100 px-1">브랜드 · 지점 · 시작일 · 종료일 · 채널(선택) · 벤더(선택)</code> · 날짜는 2026-06-24 또는 6-24
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
        placeholder={"락앤락\t야탑\t2026-06-24\t2026-06-30\t리테일(MDM)\t락앤락\n테팔\t분당\t2026-06-27\t2026-06-30\t킴스(PDM)\tSCK"}
        className="w-full border-[2px] border-[#0a0a0a] p-2 font-mono text-[11px] focus:outline-none focus:bg-yellow-50" />
      <div className="flex items-center gap-3 mt-2">
        <button onClick={() => onSave(parsed.rows, () => setText(""))} disabled={pending || parsed.rows.length === 0}
          className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-4 py-1.5 text-[13px] font-bold hover:bg-yellow-400 disabled:opacity-50">
          {pending ? "등록 중…" : `${parsed.rows.length}건 등록`}
        </button>
        {parsed.errs.length > 0 && <span className="text-[11px] text-rose-600">{parsed.errs.length}개 행 오류: {parsed.errs[0]}</span>}
      </div>
    </div>
  );
}
