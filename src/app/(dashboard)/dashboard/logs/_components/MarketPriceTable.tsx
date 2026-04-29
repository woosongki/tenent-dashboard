"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { MarketPriceRow } from "@/types/marketPrice";
import {
  MARKET_BRANDS, MARKET_CONTRACT_TYPES, MARKET_SIZE_RANGES,
  MARKET_FLOOR_TYPES, MARKET_STORE_TYPES, MARKET_REGIONS,
  MARKET_RELIABILITIES, MARKET_PRICE_TRENDS, MARKET_DATA_SOURCES,
  RELIABILITY_META, TREND_META,
} from "@/types/marketPrice";
import { upsertMarketPriceRow, deleteMarketPriceRow } from "@/lib/marketPrice/actions";

// ── Badges ───────────────────────────────────────────────────
function ReliabilityBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-200">—</span>;
  const m = RELIABILITY_META[value];
  if (!m) return <span className="text-xs text-slate-400">{value}</span>;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function TrendBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-200">—</span>;
  const m = TREND_META[value];
  if (!m) return <span className="text-xs text-slate-400">{value}</span>;
  return <span className={`text-xs font-bold ${m.cls}`}>{m.icon} {m.label}</span>;
}

// ── Kebab Menu ───────────────────────────────────────────────
function KebabMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        aria-label="행 메뉴"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-28 overflow-hidden rounded-xl border border-[#e8ecf0] bg-white py-1 shadow-lg">
          <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
            수정
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────
const INPUT_CLS = "w-full rounded-lg border border-[#e8ecf0] px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:border-transparent";
const LABEL_CLS = "mb-1 block text-xs font-medium text-slate-500";

function RowModal({ row, onClose }: { row: Partial<MarketPriceRow> | null; onClose: () => void }) {
  const isNew = !row?.id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => (fd.get(k) as string) || null;
    setError(null);
    startTransition(async () => {
      const res = await upsertMarketPriceRow(isNew ? null : row!.id!, {
        name:                String(fd.get("name") ?? ""),
        brand:               get("brand"),
        contract_type:       get("contract_type"),
        size_range:          get("size_range"),
        deposit_median:      get("deposit_median"),
        monthly_rent_median: get("monthly_rent_median"),
        floor_type:          get("floor_type"),
        rent_per_pyeong:     get("rent_per_pyeong"),
        store_type:          get("store_type"),
        region:              get("region"),
        reliability:         get("reliability"),
        price_trend:         get("price_trend"),
        data_source:         get("data_source"),
        sample_count:        get("sample_count"),
        note:                get("note"),
        last_updated:        get("last_updated"),
      });
      if (!res.ok) { setError(res.error); return; }
      toast.success(isNew ? "데이터가 추가됐습니다." : "수정이 저장됐습니다.");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e8ecf0] px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-slate-800">{isNew ? "시세 데이터 추가" : "시세 데이터 수정"}</h2>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LABEL_CLS}>지점명 *</label>
              <input ref={firstRef} name="name" required defaultValue={row?.name ?? ""} className={INPUT_CLS} placeholder="예: 야탑점 · 소규모 · 월세 · 10평미만" />
            </div>
            <div>
              <label className={LABEL_CLS}>브랜드</label>
              <select name="brand" defaultValue={row?.brand ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>지역구분</label>
              <select name="region" defaultValue={row?.region ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>계약유형</label>
              <select name="contract_type" defaultValue={row?.contract_type ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>평수구간</label>
              <select name="size_range" defaultValue={row?.size_range ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_SIZE_RANGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>층수</label>
              <select name="floor_type" defaultValue={row?.floor_type ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_FLOOR_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>상가유형</label>
              <select name="store_type" defaultValue={row?.store_type ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_STORE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>보증금_중앙값</label>
              <input name="deposit_median" defaultValue={row?.deposit_median ?? ""} className={INPUT_CLS} placeholder="예: 500만원" />
            </div>
            <div>
              <label className={LABEL_CLS}>월세_중앙값</label>
              <input name="monthly_rent_median" defaultValue={row?.monthly_rent_median ?? ""} className={INPUT_CLS} placeholder="예: 120만원" />
            </div>
            <div>
              <label className={LABEL_CLS}>평당월세_역산</label>
              <input name="rent_per_pyeong" defaultValue={row?.rent_per_pyeong ?? ""} className={INPUT_CLS} placeholder="예: 12만원/평" />
            </div>
            <div>
              <label className={LABEL_CLS}>표본건수</label>
              <input name="sample_count" defaultValue={row?.sample_count ?? ""} className={INPUT_CLS} placeholder="예: 8건" />
            </div>
            <div>
              <label className={LABEL_CLS}>지수추세</label>
              <select name="price_trend" defaultValue={row?.price_trend ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_PRICE_TRENDS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>신뢰도</label>
              <select name="reliability" defaultValue={row?.reliability ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_RELIABILITIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>데이터출처</label>
              <select name="data_source" defaultValue={row?.data_source ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {MARKET_DATA_SOURCES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>최종갱신일</label>
              <input name="last_updated" type="date" defaultValue={row?.last_updated ?? ""} className={INPUT_CLS} />
            </div>
            <div className="col-span-2">
              <label className={LABEL_CLS}>비고</label>
              <textarea name="note" rows={2} defaultValue={row?.note ?? ""} className={`${INPUT_CLS} resize-none`} />
            </div>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#e8ecf0] px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">취소</button>
            <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
              {pending && <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Table ───────────────────────────────────────────────
interface Props { rows: MarketPriceRow[] }

export default function MarketPriceTable({ rows: initialRows }: Props) {
  const [rows, setRows]     = useState(initialRows);
  const [modalRow, setModalRow] = useState<Partial<MarketPriceRow> | null | false>(false);
  const [, startTransition] = useTransition();

  // 필터
  const [q, setQ]           = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [fContract, setFContract] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const qLow = q.toLowerCase();
      if (q && !r.name.toLowerCase().includes(qLow)) return false;
      if (fBrand   && r.brand         !== fBrand)    return false;
      if (fRegion  && r.region        !== fRegion)   return false;
      if (fContract && r.contract_type !== fContract) return false;
      return true;
    });
  }, [rows, q, fBrand, fRegion, fContract]);

  function handleDelete(id: string, name: string) {
    toast(
      `"${name}" 데이터를 삭제하시겠습니까?`,
      {
        action:  { label: "삭제", onClick: () => {
          setRows((prev) => prev.filter((r) => r.id !== id));
          startTransition(async () => {
            const res = await deleteMarketPriceRow(id);
            if (!res.ok) setRows(initialRows);
            else toast.success("삭제됐습니다.");
          });
        }},
        cancel: { label: "취소", onClick: () => {} },
      }
    );
  }

  const TH = ({ children }: { children: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-slate-400 whitespace-nowrap">{children}</th>
  );

  return (
    <>
      {/* 필터 바 */}
      <div className="rounded-xl border border-[#e8ecf0] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="지점명 검색…"
            className="h-8 rounded-lg border border-[#e8ecf0] px-3 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300 w-48"
          />
          <select value={fBrand} onChange={(e) => setFBrand(e.target.value)} className="h-8 rounded-lg border border-[#e8ecf0] px-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300">
            <option value="">전체 브랜드</option>
            {MARKET_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={fRegion} onChange={(e) => setFRegion(e.target.value)} className="h-8 rounded-lg border border-[#e8ecf0] px-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300">
            <option value="">전체 지역</option>
            {MARKET_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={fContract} onChange={(e) => setFContract(e.target.value)} className="h-8 rounded-lg border border-[#e8ecf0] px-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300">
            <option value="">전체 계약유형</option>
            {MARKET_CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} / {rows.length}건</span>
          <button
            type="button"
            onClick={() => setModalRow({})}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            데이터 추가
          </button>
        </div>
      </div>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#e8ecf0] bg-white py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          <p className="text-sm text-slate-400">{q || fBrand || fRegion || fContract ? "조건에 맞는 데이터가 없습니다" : "등록된 시세 데이터가 없습니다"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  <TH>지점명</TH>
                  <TH>브랜드</TH>
                  <TH>지역</TH>
                  <TH>계약유형</TH>
                  <TH>평수구간</TH>
                  <TH>층수</TH>
                  <TH>월세_중앙값</TH>
                  <TH>보증금_중앙값</TH>
                  <TH>평당월세</TH>
                  <TH>지수추세</TH>
                  <TH>신뢰도</TH>
                  <TH>최종갱신일</TH>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {filtered.map((row) => (
                  <tr key={row.id} className="group border-l-[3px] border-l-transparent transition-all hover:border-l-violet-500 hover:bg-[#faf8ff]">
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap max-w-[200px] truncate">{row.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{row.brand ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{row.region ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {row.contract_type
                        ? <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${row.contract_type === "월세" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>{row.contract_type}</span>
                        : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{row.size_range ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{row.floor_type ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">{row.monthly_rent_median ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{row.deposit_median ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{row.rent_per_pyeong ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><TrendBadge value={row.price_trend} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><ReliabilityBadge value={row.reliability} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{row.last_updated ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-3 py-3">
                      <KebabMenu
                        onEdit={() => setModalRow(row)}
                        onDelete={() => handleDelete(row.id, row.name)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalRow !== false && (
        <RowModal row={modalRow || null} onClose={() => setModalRow(false)} />
      )}
    </>
  );
}
