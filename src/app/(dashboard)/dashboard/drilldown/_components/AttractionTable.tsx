"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { AttractionRow } from "@/types/attraction";
import { ATTRACTION_CATEGORIES, ATTRACTION_BRANCHES, ATTRACTION_FLOORS } from "@/types/attraction";
import { upsertAttractionRow, deleteAttractionRow } from "../_actions/attraction";

// ── Helpers ─────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  스포츠:      "bg-blue-50 text-blue-700",
  키즈카페:    "bg-yellow-50 text-yellow-700",
  "팬시/굿즈": "bg-fuchsia-50 text-fuchsia-700",
  빅컨텐츠:   "bg-purple-50 text-purple-700",
  리빙:       "bg-teal-50 text-teal-700",
  뷰티:       "bg-rose-50 text-rose-700",
  체험:       "bg-orange-50 text-orange-700",
  가전:       "bg-cyan-50 text-cyan-700",
  기타:       "bg-slate-100 text-slate-600",
};

function CategoryBadge({ cat }: { cat: string | null }) {
  const label = cat ?? "기타";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CAT_COLORS[label] ?? CAT_COLORS["기타"]}`}>
      {label}
    </span>
  );
}

function StatusBadge({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 완료
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 진행중
    </span>
  );
}

// ── Kebab Menu ───────────────────────────────────────────────
function KebabMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            수정
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

// ── Row Modal ────────────────────────────────────────────────
interface ModalProps {
  row: Partial<AttractionRow> | null;
  onClose: () => void;
}

const INPUT_CLS = "w-full rounded-lg border border-[#e8ecf0] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:border-transparent";
const LABEL_CLS = "mb-1 block text-xs font-medium text-slate-500";

function RowModal({ row, onClose }: ModalProps) {
  const isNew = !row?.id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await upsertAttractionRow(isNew ? null : row!.id!, {
        brand_name:   String(fd.get("brand_name") ?? ""),
        branch:       String(fd.get("branch") ?? "") || null,
        floor:        String(fd.get("floor") ?? "") || null,
        category:     String(fd.get("category") ?? "") || null,
        size_pyeong:  fd.get("size_pyeong") ? Number(fd.get("size_pyeong")) : null,
        manager:      String(fd.get("manager") ?? "") || null,
        is_completed: fd.get("is_completed") === "true",
        memo:         String(fd.get("memo") ?? "") || null,
        notion_url:   String(fd.get("notion_url") ?? "") || null,
      });
      if (res.error) { setError(res.error); return; }
      toast.success(isNew ? "브랜드가 추가됐습니다." : "수정이 저장됐습니다.");
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e8ecf0] px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-800">
            {isNew ? "브랜드 추가" : "브랜드 수정"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 transition-colors hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg p-1"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>브랜드명 *</label>
              <input ref={firstRef} name="brand_name" required defaultValue={row?.brand_name ?? ""} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>지점</label>
              <select name="branch" defaultValue={row?.branch ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {ATTRACTION_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>층</label>
              <select name="floor" defaultValue={row?.floor ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {ATTRACTION_FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>카테고리</label>
              <select name="category" defaultValue={row?.category ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {ATTRACTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>규모(평)</label>
              <input name="size_pyeong" type="number" step="0.1" defaultValue={row?.size_pyeong ?? ""} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>담당자</label>
              <input name="manager" defaultValue={row?.manager ?? ""} className={INPUT_CLS} />
            </div>
          </div>
          <div>
            <label className={LABEL_CLS}>완료 여부</label>
            <select name="is_completed" defaultValue={row?.is_completed ? "true" : "false"} className={INPUT_CLS}>
              <option value="false">진행중</option>
              <option value="true">완료</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>메모</label>
            <textarea name="memo" rows={2} defaultValue={row?.memo ?? ""} className={`${INPUT_CLS} resize-none`} />
          </div>
          <div>
            <label className={LABEL_CLS}>노션 URL</label>
            <input name="notion_url" defaultValue={row?.notion_url ?? ""} className={INPUT_CLS} />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e8ecf0] px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >취소</button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              {pending && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Table ───────────────────────────────────────────────
interface Props {
  rows: AttractionRow[];
  /** 외부(BranchProgressGrid)에서 선택된 지점 — 표를 해당 지점으로 필터 */
  branchFilter?: string | null;
  /** 표 안의 지점 칩에서 X 누르면 부모 상태 초기화 */
  onClearBranch?: () => void;
}

export default function AttractionTable({ rows, branchFilter = null, onClearBranch }: Props) {
  const [filterCat,    setFilterCat]    = useState<string>("전체");
  const [filterStatus, setFilterStatus] = useState<string>("전체");
  const [editRow,      setEditRow]      = useState<Partial<AttractionRow> | null | undefined>(undefined);
  const [, startTransition]             = useTransition();

  const filtered = rows.filter((r) => {
    const catOk    = filterCat    === "전체" || r.category === filterCat;
    const statusOk = filterStatus === "전체" ||
      (filterStatus === "완료" ? r.is_completed : !r.is_completed);
    const branchOk = !branchFilter || r.branch === branchFilter;
    return catOk && statusOk && branchOk;
  });

  function handleDelete(id: string, name: string) {
    toast("삭제하시겠습니까?", {
      action: {
        label: "삭제",
        onClick: () => {
          startTransition(async () => {
            const res = await deleteAttractionRow(id);
            if (res && "error" in res && res.error) {
              toast.error("삭제에 실패했습니다.");
            } else {
              toast.success(`'${name}' 삭제됐습니다.`);
            }
          });
        },
      },
      cancel: { label: "취소", onClick: () => {} },
    });
  }

  return (
    <>
      {/* Filters + Add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {["전체", ...ATTRACTION_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  filterCat === cat
                    ? "bg-violet-600 text-white"
                    : "border border-[#e8ecf0] bg-white text-slate-500 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {["전체", "완료", "진행중"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  filterStatus === s
                    ? "bg-slate-800 text-white"
                    : "border border-[#e8ecf0] bg-white text-slate-500 hover:border-slate-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setEditRow({})}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          브랜드 추가
        </button>
      </div>

      {/* Active branch chip */}
      {branchFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 border border-violet-200">
            지점: {branchFilter}
            {onClearBranch && (
              <button
                type="button"
                onClick={onClearBranch}
                aria-label={`${branchFilter} 필터 해제`}
                className="ml-0.5 rounded-full p-0.5 text-violet-500 hover:bg-violet-100 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        </div>
      )}

      {/* Count summary */}
      <p className="text-xs text-slate-400">
        총 <span className="font-semibold text-slate-600">{filtered.length}</span>건
        {branchFilter && ` · ${branchFilter}`}
        {filterCat !== "전체" && ` · ${filterCat}`}
        {filterStatus !== "전체" && ` · ${filterStatus}`}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-[.05em] text-slate-400">
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">브랜드명</th>
              <th className="px-4 py-3 text-left">지점</th>
              <th className="px-4 py-3 text-left">층</th>
              <th className="px-4 py-3 text-left">카테고리</th>
              <th className="px-4 py-3 text-right">규모(평)</th>
              <th className="px-4 py-3 text-left">담당자</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-left">메모</th>
              <th className="px-4 py-3 text-center w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f8fafc]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={row.id}
                  className="border-l-[3px] border-l-transparent transition-all hover:border-l-violet-500 hover:bg-[#faf8ff]"
                >
                  <td className="px-4 py-3 text-xs text-slate-300">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {row.notion_url ? (
                      <a
                        href={row.notion_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-violet-600 transition-colors"
                      >
                        {row.brand_name}
                        <svg className="ml-1 inline h-3 w-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    ) : row.brand_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.branch ?? <span className="text-slate-200">—</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{row.floor   ?? <span className="text-slate-200">—</span>}</td>
                  <td className="px-4 py-3"><CategoryBadge cat={row.category} /></td>
                  <td className="px-4 py-3 text-right tabular-nums text-[12px] text-slate-600">
                    {row.size_pyeong != null ? row.size_pyeong.toLocaleString() : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.manager ?? <span className="text-slate-200">—</span>}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge done={row.is_completed} /></td>
                  <td className="px-4 py-3 max-w-[180px] truncate text-xs text-slate-400">
                    {row.memo ?? <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <KebabMenu
                      onEdit={() => setEditRow(row)}
                      onDelete={() => handleDelete(row.id, row.brand_name)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editRow !== undefined && (
        <RowModal row={editRow} onClose={() => setEditRow(undefined)} />
      )}
    </>
  );
}
