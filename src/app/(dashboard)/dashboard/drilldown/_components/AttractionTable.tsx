"use client";

import { useState, useTransition } from "react";
import type { AttractionRow } from "@/types/attraction";
import { ATTRACTION_CATEGORIES } from "@/types/attraction";
import { upsertAttractionRow, deleteAttractionRow } from "../_actions/attraction";

// ── Helpers ─────────────────────────────────────────────────
function CategoryBadge({ cat }: { cat: string | null }) {
  const colors: Record<string, string> = {
    스포츠:    "bg-blue-50 text-blue-700",
    키즈카페:  "bg-yellow-50 text-yellow-700",
    "팬시/굿즈": "bg-pink-50 text-pink-700",
    빅컨텐츠: "bg-purple-50 text-purple-700",
    리빙:     "bg-green-50 text-green-700",
    뷰티:     "bg-rose-50 text-rose-700",
    체험:     "bg-orange-50 text-orange-700",
    가전:     "bg-cyan-50 text-cyan-700",
    기타:     "bg-gray-50 text-gray-600",
  };
  const label = cat ?? "기타";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[label] ?? colors["기타"]}`}>
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

// ── Row Modal ────────────────────────────────────────────────
interface ModalProps {
  row: Partial<AttractionRow> | null;
  onClose: () => void;
}

function RowModal({ row, onClose }: ModalProps) {
  const isNew = !row?.id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await upsertAttractionRow(isNew ? null : row!.id!, {
        brand_name: String(fd.get("brand_name") ?? ""),
        branch: String(fd.get("branch") ?? "") || null,
        floor: String(fd.get("floor") ?? "") || null,
        category: String(fd.get("category") ?? "") || null,
        size_pyeong: fd.get("size_pyeong") ? Number(fd.get("size_pyeong")) : null,
        manager: String(fd.get("manager") ?? "") || null,
        is_completed: fd.get("is_completed") === "true",
        memo: String(fd.get("memo") ?? "") || null,
        notion_url: String(fd.get("notion_url") ?? "") || null,
      });
      if (res.error) { setError(res.error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          {isNew ? "브랜드 추가" : "브랜드 수정"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">브랜드명 *</label>
              <input name="brand_name" required defaultValue={row?.brand_name ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">지점</label>
              <input name="branch" defaultValue={row?.branch ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">층</label>
              <input name="floor" defaultValue={row?.floor ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">카테고리</label>
              <select name="category" defaultValue={row?.category ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">선택</option>
                {ATTRACTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">규모(평)</label>
              <input name="size_pyeong" type="number" step="0.1" defaultValue={row?.size_pyeong ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">담당자</label>
              <input name="manager" defaultValue={row?.manager ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">완료 여부</label>
            <select name="is_completed" defaultValue={row?.is_completed ? "true" : "false"} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="false">진행중</option>
              <option value="true">완료</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">메모</label>
            <textarea name="memo" rows={2} defaultValue={row?.memo ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">노션 URL</label>
            <input name="notion_url" defaultValue={row?.notion_url ?? ""} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
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
}

export default function AttractionTable({ rows }: Props) {
  const [filterCat, setFilterCat] = useState<string>("전체");
  const [filterStatus, setFilterStatus] = useState<string>("전체");
  const [editRow, setEditRow] = useState<Partial<AttractionRow> | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = rows.filter((r) => {
    const catOk = filterCat === "전체" || r.category === filterCat;
    const statusOk =
      filterStatus === "전체" ||
      (filterStatus === "완료" ? r.is_completed : !r.is_completed);
    return catOk && statusOk;
  });

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAttractionRow(id);
      setDeletingId(null);
    });
  }

  return (
    <>
      {/* Filters + Add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            {["전체", ...ATTRACTION_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterCat === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="flex gap-1.5">
            {["전체", "완료", "진행중"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-gray-800 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setEditRow({})}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          브랜드 추가
        </button>
      </div>

      {/* Count summary */}
      <p className="text-xs text-gray-400">
        총 <span className="font-semibold text-gray-600">{filtered.length}</span>건
        {filterCat !== "전체" && ` · ${filterCat}`}
        {filterStatus !== "전체" && ` · ${filterStatus}`}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-3 font-medium text-left w-8">#</th>
              <th className="px-4 py-3 font-medium text-left">브랜드명</th>
              <th className="px-4 py-3 font-medium text-left">지점</th>
              <th className="px-4 py-3 font-medium text-left">층</th>
              <th className="px-4 py-3 font-medium text-left">카테고리</th>
              <th className="px-4 py-3 font-medium text-right">규모(평)</th>
              <th className="px-4 py-3 font-medium text-left">담당자</th>
              <th className="px-4 py-3 font-medium text-center">상태</th>
              <th className="px-4 py-3 font-medium text-left">메모</th>
              <th className="px-4 py-3 font-medium text-center w-16">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`group transition-colors ${
                    deletingId === row.id ? "bg-rose-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {row.notion_url ? (
                      <a href={row.notion_url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">
                        {row.brand_name}
                        <svg className="ml-1 inline h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    ) : (
                      row.brand_name
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.branch ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{row.floor ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3"><CategoryBadge cat={row.category} /></td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {row.size_pyeong != null ? row.size_pyeong.toLocaleString() : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.manager ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge done={row.is_completed} /></td>
                  <td className="px-4 py-3 max-w-[180px] truncate text-xs text-gray-500">
                    {row.memo ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {deletingId === row.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleDelete(row.id)} className="rounded px-2 py-1 text-[10px] font-medium text-white bg-rose-500 hover:bg-rose-600">확인</button>
                        <button onClick={() => setDeletingId(null)} className="rounded px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">취소</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditRow(row)}
                          className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="편집"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingId(row.id)}
                          className="rounded p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

      {/* Modal */}
      {editRow !== undefined && (
        <RowModal row={editRow} onClose={() => setEditRow(undefined)} />
      )}
    </>
  );
}
