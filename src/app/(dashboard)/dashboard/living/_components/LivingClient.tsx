"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  type LivingPopup, type WeekRow, type PopupStatus,
  CHANNELS, POPUP_TYPES, PROMOS, LIVING_BRANDS, LIVING_STORES,
  popupStatus, STATUS_LABEL, weekIndexOf,
} from "@/lib/livingPopup";
import { createPopup, updatePopup, deletePopup, type PopupInput } from "../_actions";

type Tab = "calendar" | "list" | "analytics" | "gaps";

const INP = "w-full border-[2px] border-[#0a0a0a] px-2 py-1.5 text-[12px] outline-none focus:bg-yellow-50";

const STATUS_STYLE: Record<PopupStatus, { bg: string; bd: string; tx: string }> = {
  done: { bg: "bg-emerald-50", bd: "border-emerald-500", tx: "text-emerald-700" },
  live: { bg: "bg-amber-50",   bd: "border-amber-500",   tx: "text-amber-700" },
  plan: { bg: "bg-sky-50",     bd: "border-sky-500",     tx: "text-sky-700" },
};

interface Draft extends PopupInput { id?: string; }

export default function LivingClient({ popups, weeks, year, canEdit }: {
  popups: LivingPopup[]; weeks: WeekRow[]; year: number; canEdit: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("calendar");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  // 그리드 컬럼 = 데이터에 있는 브랜드 (없으면 기본 일부)
  const brands = useMemo(() => {
    const set = new Set(popups.map((p) => p.brand));
    if (set.size === 0) return [...LIVING_BRANDS.slice(0, 6)];
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
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

  function openNew(brand?: string, week?: WeekRow) {
    setEditing({
      brand: brand ?? brands[0] ?? "", store: "",
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

  const tabs: [Tab, string][] = [["calendar", "캘린더"], ["list", "목록"], ["analytics", "실적분석"], ["gaps", "빈 슬롯"]];

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
        <CalendarGrid weeks={weeks} brands={brands} byCell={byCell} canEdit={canEdit}
          onCell={(b, w) => canEdit && openNew(b, w)} onChip={openEdit} />
      )}
      {tab === "list" && <ListTab popups={popups} onRow={canEdit ? openEdit : undefined} />}
      {tab === "analytics" && <AnalyticsTab popups={popups} />}
      {tab === "gaps" && <GapsTab popups={popups} weeks={weeks} brands={brands} onPick={canEdit ? openNew : undefined} />}

      {editing && (
        <Editor draft={editing} setDraft={setEditing} onSave={save} onDelete={remove}
          onClose={() => setEditing(null)} pending={pending} />
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
                            <div className={`text-[9px] ${s.tx} opacity-70 truncate`}>{p.vendor ?? "벤더 미정"}</div>
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

// ── 빈 슬롯 탭 ──────────────────────────────────────────────
function GapsTab({ popups, weeks, brands, onPick }: {
  popups: LivingPopup[]; weeks: WeekRow[]; brands: string[]; onPick?: (brand: string, week: WeekRow) => void;
}) {
  const [brand, setBrand] = useState(brands[0] ?? "");
  const filled = useMemo(() => {
    const s = new Set<number>();
    for (const p of popups) if (p.brand === brand) s.add(weekIndexOf({ startDate: p.startDate }, weeks));
    return s;
  }, [popups, brand, weeks]);
  const todayWi = weekIndexOf({ startDate: new Date().toISOString().slice(0, 10) }, weeks);
  const future = weeks.filter((w) => w.index >= todayWi && !filled.has(w.index));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-bold">브랜드</span>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="border-[2px] border-[#0a0a0a] px-2 py-1">
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <span className="text-slate-500">앞으로 비어있는 주차 {future.length}개</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {future.map((w) => (
          <button key={w.index} onClick={() => onPick?.(brand, w)} disabled={!onPick}
            className="border-[2px] border-dashed border-slate-300 bg-white px-2 py-2 text-left hover:border-[#0a0a0a] hover:bg-yellow-50 disabled:hover:bg-white">
            <div className="text-[12px] font-bold text-[#0a0a0a]">{w.label}</div>
            <div className="text-[10px] text-slate-400">{w.rangeText}</div>
            {onPick && <div className="text-[10px] text-sky-600 mt-1">+ 여기에 배치</div>}
          </button>
        ))}
        {future.length === 0 && <div className="col-span-full px-3 py-6 text-center text-[12px] text-slate-400">남은 주차가 모두 배치됨</div>}
      </div>
    </div>
  );
}

// ── 편집 패널 ───────────────────────────────────────────────
function Editor({ draft, setDraft, onSave, onDelete, onClose, pending }: {
  draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onDelete: () => void; onClose: () => void; pending: boolean;
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
