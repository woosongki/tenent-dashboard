"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { formatKRW } from "@/lib/format";
import { downloadExcel } from "@/lib/excel";
import type { BrandPerformanceRow } from "@/types/performance";
import type { ExcelColumn } from "@/lib/excel";
import { CATEGORIES } from "@/types/performance";
import {
  createBrandRow,
  updateBrandRow,
  deleteBrandRow,
  type RowFormData,
} from "../_actions/performance";

const EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "카테고리",     key: "category",             width: 14 },
  { header: "브랜드코드",   key: "brand_code",            width: 10 },
  { header: "브랜드명",     key: "brand_name",            width: 24 },
  { header: "매출(현기간)", key: "revenue_current",       width: 16 },
  { header: "매출(전기간)", key: "revenue_prev",          width: 16 },
  { header: "매출성장율(%)", key: "revenue_growth",       width: 14 },
  { header: "이익(현기간)", key: "gross_profit_current", width: 16 },
  { header: "이익(전기간)", key: "gross_profit_prev",    width: 16 },
  { header: "이익성장율(%)", key: "gross_profit_growth", width: 14 },
];

const EMPTY_FORM: RowFormData = {
  category: CATEGORIES[0],
  brand_code: "",
  brand_name: "",
  revenue_current: "",
  revenue_prev: "",
  gross_profit_current: "",
  gross_profit_prev: "",
};

function rowToForm(r: BrandPerformanceRow): RowFormData {
  return {
    category: r.category,
    brand_code: r.brand_code ?? "",
    brand_name: r.brand_name,
    revenue_current: r.revenue_current?.toString() ?? "",
    revenue_prev: r.revenue_prev?.toString() ?? "",
    gross_profit_current: r.gross_profit_current?.toString() ?? "",
    gross_profit_prev: r.gross_profit_prev?.toString() ?? "",
  };
}

function GrowthCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-200">—</span>;
  const pos = value >= 0;
  return (
    <span className={`font-medium ${pos ? "text-emerald-600" : "text-rose-500"}`}>
      {pos ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

interface Props {
  rows: BrandPerformanceRow[];
}

export default function PerformanceTable({ rows }: Props) {
  const [search,       setSearch]       = useState("");
  const [category,     setCategory]     = useState("전체");
  const [excelLoading, setExcelLoading] = useState(false);

  const [editTarget, setEditTarget]   = useState<BrandPerformanceRow | null>(null);
  const [modalOpen,  setModalOpen]    = useState(false);
  const [deleteId,   setDeleteId]     = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  const brandRows = useMemo(() => rows.filter((r) => r.row_type === "brand"), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return brandRows.filter((r) => {
      if (category !== "전체" && r.category !== category) return false;
      if (q && !r.brand_name.toLowerCase().includes(q) &&
               !(r.brand_code ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [brandRows, search, category]);

  function openAdd()  { setEditTarget(null); setModalOpen(true); }
  function openEdit(row: BrandPerformanceRow) { setEditTarget(row); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditTarget(null); }
  function handleDelete(id: string) { setDeleteId(id); }

  function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => { await deleteBrandRow(id); });
  }

  function handleExport() {
    setExcelLoading(true);
    try {
      downloadExcel("브랜드_성과분석", EXCEL_COLUMNS, filtered as unknown as Record<string, unknown>[]);
    } finally {
      setExcelLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* 필터 + 액션 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="브랜드명 · 코드 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full rounded-lg border border-[#e8ecf0] px-3 text-sm placeholder-slate-300 focus:border-violet-400 focus:outline-none sm:w-48"
        />
        <div className="flex gap-1 flex-wrap">
          {["전체", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                category === c
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400">{filtered.length}개 브랜드</span>

        {/* 엑셀 */}
        <button
          onClick={handleExport}
          disabled={excelLoading || filtered.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v4m0 0l-3-3m3 3l3-3M12 4v8" />
          </svg>
          엑셀
        </button>

        {/* 추가 */}
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          브랜드 추가
        </button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] text-left text-[11px] font-semibold uppercase tracking-[.05em] text-slate-400">
              <th className="px-3 py-3 sm:px-4">카테고리</th>
              <th className="px-3 py-3 sm:px-4">코드</th>
              <th className="px-3 py-3 sm:px-4">브랜드명</th>
              <th className="px-3 py-3 text-right sm:px-4">매출(현)</th>
              <th className="hidden px-3 py-3 text-right md:table-cell sm:px-4">매출(전)</th>
              <th className="px-3 py-3 text-right sm:px-4">매출증감</th>
              <th className="hidden px-3 py-3 text-right lg:table-cell sm:px-4">이익(현)</th>
              <th className="hidden px-3 py-3 text-right lg:table-cell sm:px-4">이익(전)</th>
              <th className="hidden px-3 py-3 text-right lg:table-cell sm:px-4">이익증감</th>
              <th className="px-3 py-3 sm:px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f8fafc]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-sm text-slate-400">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`group border-l-[3px] border-l-transparent transition-all hover:border-l-violet-500 hover:bg-[#faf8ff] ${
                    deleteId === r.id ? "bg-rose-50" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                    <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 whitespace-nowrap">
                      {r.category}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300 sm:px-4 sm:py-3">
                    {r.brand_code ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700 sm:px-4 sm:py-3">
                    {r.brand_name}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[12px] text-slate-600 sm:px-4 sm:py-3">
                    {r.revenue_current !== null ? formatKRW(r.revenue_current) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-[12px] text-slate-300 md:table-cell sm:px-4 sm:py-3">
                    {r.revenue_prev !== null ? formatKRW(r.revenue_prev) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[12px] sm:px-4 sm:py-3">
                    <GrowthCell value={r.revenue_growth} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-[12px] text-slate-600 lg:table-cell sm:px-4 sm:py-3">
                    {r.gross_profit_current !== null ? formatKRW(r.gross_profit_current) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-[12px] text-slate-300 lg:table-cell sm:px-4 sm:py-3">
                    {r.gross_profit_prev !== null ? formatKRW(r.gross_profit_prev) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-[12px] lg:table-cell sm:px-4 sm:py-3">
                    <GrowthCell value={r.gross_profit_growth} />
                  </td>

                  {/* 액션 */}
                  <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                    {deleteId === r.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs text-rose-500 mr-1">삭제?</span>
                        <button
                          onClick={confirmDelete}
                          disabled={isPending}
                          className="rounded px-2 py-1 text-xs font-medium bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                        >확인</button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="rounded px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >취소</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded p-1 text-slate-300 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                          title="수정"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                          title="삭제"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && <RowModal target={editTarget} onClose={closeModal} />}
    </div>
  );
}

// ── 편집 / 추가 모달 ────────────────────────────────────────────
function RowModal({
  target,
  onClose,
}: {
  target: BrandPerformanceRow | null;
  onClose: () => void;
}) {
  const isEdit = target !== null;
  const [form, setForm]               = useState<RowFormData>(isEdit ? rowToForm(target) : EMPTY_FORM);
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();
  const firstRef                      = useRef<HTMLSelectElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  function set(key: keyof RowFormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = isEdit
        ? await updateBrandRow(target.id, form)
        : await createBrandRow(form);
      if (res.error) { setError(res.error); return; }
      onClose();
    });
  }

  const inputCls = "w-full rounded-lg border border-[#e8ecf0] px-3 py-2 text-sm focus:border-violet-400 focus:outline-none";
  const labelCls = "block text-xs font-medium text-slate-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#e8ecf0] px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-800">
            {isEdit ? "브랜드 수정" : "브랜드 추가"}
          </h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label className={labelCls}>카테고리 *</label>
              <select
                ref={firstRef}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label className={labelCls}>브랜드 코드</label>
              <input
                type="text" value={form.brand_code}
                onChange={(e) => set("brand_code", e.target.value)}
                placeholder="예: BR001" className={inputCls}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className={labelCls}>브랜드명 *</label>
              <input
                type="text" value={form.brand_name}
                onChange={(e) => set("brand_name", e.target.value)}
                placeholder="브랜드명 입력" required className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>매출 (현기간)</label>
              <input type="number" value={form.revenue_current}
                onChange={(e) => set("revenue_current", e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>매출 (전기간)</label>
              <input type="number" value={form.revenue_prev}
                onChange={(e) => set("revenue_prev", e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>이익 (현기간)</label>
              <input type="number" value={form.gross_profit_current}
                onChange={(e) => set("gross_profit_current", e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>이익 (전기간)</label>
              <input type="number" value={form.gross_profit_prev}
                onChange={(e) => set("gross_profit_prev", e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
          </div>

          <p className="text-[11px] text-slate-300">* 성장률은 현기간/전기간 값으로 자동 계산됩니다.</p>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="rounded-lg border border-[#e8ecf0] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >취소</button>
            <button
              type="submit" disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {isPending && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {isEdit ? "저장" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
