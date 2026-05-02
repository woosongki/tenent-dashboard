"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { VendorLeaseRow } from "@/types/vendorLease";
import { LEASE_SCORES, LEASE_STATUSES, LEASE_STATUS_META, LEASE_TYPE_OPTIONS } from "@/types/vendorLease";
import { upsertVendorLease, deleteVendorLease } from "@/lib/vendorLease/actions";
import FilterDrawer from "@/components/ui/FilterDrawer";

// ── Badges ───────────────────────────────────────────────────
function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-200">—</span>;
  const m = LEASE_STATUS_META[value];
  if (!m) return <span className="text-xs text-slate-400">{value}</span>;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function ScoreBadge({ value }: { value: string | null }) {
  if (!value || value === "미정") return <span className="text-xs text-slate-300">미정</span>;
  return <span className="text-xs">{value}</span>;
}

function TypeTags({ types }: { types: string[] }) {
  if (!types.length) return <span className="text-slate-200">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {types.slice(0, 3).map((t) => (
        <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{t}</span>
      ))}
      {types.length > 3 && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">+{types.length - 3}</span>
      )}
    </div>
  );
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
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label="행 메뉴">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" /></svg>
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

function RowModal({ row, onClose }: { row: Partial<VendorLeaseRow> | null; onClose: () => void }) {
  const isNew = !row?.id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(row?.types ?? []);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  function toggleType(t: string) {
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => (fd.get(k) as string) || null;
    setError(null);
    startTransition(async () => {
      const res = await upsertVendorLease(isNew ? null : row!.id!, {
        name:       String(fd.get("name") ?? ""),
        types:      selectedTypes,
        score:      get("score"),
        is_checked: fd.get("is_checked") === "true",
        status:     get("status"),
        link:       get("link"),
        contact:    get("contact"),
        keyman:     get("keyman"),
        memo:       get("memo"),
      });
      if (!res.ok) { setError(res.error); return; }
      toast.success(isNew ? "업체가 추가됐습니다." : "수정이 저장됐습니다.");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e8ecf0] px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-slate-800">{isNew ? "라이프스타일 업체 추가" : "라이프스타일 업체 수정"}</h2>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LABEL_CLS}>업체명 *</label>
              <input ref={firstRef} name="name" required defaultValue={row?.name ?? ""} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>상태</label>
              <select name="status" defaultValue={row?.status ?? ""} className={INPUT_CLS}>
                <option value="">선택</option>
                {LEASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>점수</label>
              <select name="score" defaultValue={row?.score ?? ""} className={INPUT_CLS}>
                <option value="">미정</option>
                {LEASE_SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>키맨</label>
              <input name="keyman" defaultValue={row?.keyman ?? ""} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>연락처</label>
              <input name="contact" defaultValue={row?.contact ?? ""} className={INPUT_CLS} />
            </div>
            <div className="col-span-2">
              <label className={LABEL_CLS}>링크</label>
              <input name="link" type="url" defaultValue={row?.link ?? ""} className={INPUT_CLS} placeholder="https://" />
            </div>
          </div>

          {/* 유형 멀티선택 */}
          <div>
            <label className={LABEL_CLS}>유형 (복수 선택 가능)</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {LEASE_TYPE_OPTIONS.map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => toggleType(t)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedTypes.includes(t)
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>기타 메모</label>
            <textarea name="memo" rows={2} defaultValue={row?.memo ?? ""} className={`${INPUT_CLS} resize-none`} />
          </div>

          <div className="flex items-center gap-2">
            <input type="hidden" name="is_checked" value="false" />
            <input
              id="is_checked_lease" name="is_checked" type="checkbox" value="true"
              defaultChecked={row?.is_checked ?? false}
              className="h-4 w-4 rounded border-[#e8ecf0] text-violet-600 focus:ring-violet-400"
              onChange={(e) => {
                const hidden = e.currentTarget.previousElementSibling as HTMLInputElement;
                hidden.value = e.currentTarget.checked ? "true" : "false";
              }}
            />
            <label htmlFor="is_checked_lease" className="text-xs text-slate-600">체크 표시</label>
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

// ── Status Funnel ─────────────────────────────────────────────
function LeaseStatusFunnel({ rows }: { rows: VendorLeaseRow[] }) {
  const steps = [
    { key: "미팅전",   label: "미팅전" },
    { key: "미팅완료", label: "미팅완료" },
    { key: "입점제안", label: "입점제안" },
    { key: "계약검토", label: "계약검토" },
    { key: "입점중",   label: "입점중" },
    { key: "입점완료", label: "입점완료" },
  ];
  const counts = steps.map((s) => ({
    ...s,
    count: rows.filter((r) => r.status === s.key).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="rounded-xl border border-[#e8ecf0] bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">입점 파이프라인</p>
      <div className="flex items-end gap-2">
        {counts.map((c) => {
          const h = Math.max(4, Math.round((c.count / max) * 48));
          const m = LEASE_STATUS_META[c.key];
          return (
            <div key={c.key} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] font-bold text-slate-700">{c.count}</span>
              <div
                className={`w-full rounded-t-sm ${m?.cls.split(" ")[0] ?? "bg-slate-100"}`}
                style={{ height: h }}
              />
              <span className="text-[9px] text-slate-400 text-center leading-tight">{c.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Table ───────────────────────────────────────────────
interface Props { rows: VendorLeaseRow[] }

export default function VendorLeaseTable({ rows: initialRows }: Props) {
  const [rows, setRows]     = useState(initialRows);
  const [modalRow, setModalRow] = useState<Partial<VendorLeaseRow> | null | false>(false);
  const [, startTransition] = useTransition();

  const [q, setQ]           = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fType, setFType]   = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const qLow = q.toLowerCase();
      if (q && !r.name.toLowerCase().includes(qLow) && !(r.keyman ?? "").toLowerCase().includes(qLow)) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (fType   && !r.types.includes(fType)) return false;
      return true;
    });
  }, [rows, q, fStatus, fType]);

  function handleDelete(id: string, name: string) {
    toast(
      `"${name}" 업체를 삭제하시겠습니까?`,
      {
        action: { label: "삭제", onClick: () => {
          setRows((prev) => prev.filter((r) => r.id !== id));
          startTransition(async () => {
            const res = await deleteVendorLease(id);
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
      {/* 파이프라인 퍼널 */}
      {rows.length > 0 && <LeaseStatusFunnel rows={rows} />}

      {/* 필터 바 */}
      <div className="rounded-xl border border-[#e8ecf0] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="업체명·키맨 검색…"
            className="h-8 rounded-lg border border-[#e8ecf0] px-3 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300 flex-1 min-w-[160px] md:flex-none md:w-44"
          />
          <FilterDrawer activeCount={[fStatus, fType].filter(Boolean).length}>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-8 rounded-lg border border-[#e8ecf0] px-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300">
              <option value="">전체 상태</option>
              {LEASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="h-8 rounded-lg border border-[#e8ecf0] px-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300">
              <option value="">전체 유형</option>
              {LEASE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FilterDrawer>
          <span className="ml-auto text-xs text-slate-400 hidden sm:inline">{filtered.length} / {rows.length}개 업체</span>
          <button
            type="button"
            onClick={() => setModalRow({})}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            업체 추가
          </button>
        </div>
      </div>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#e8ecf0] bg-white py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          <p className="text-sm text-slate-400">{q || fStatus || fType ? "조건에 맞는 업체가 없습니다" : "등록된 라이프스타일 업체가 없습니다"}</p>
          {!q && !fStatus && !fType && (
            <p className="mt-1 text-xs text-slate-300">노션 동기화 후 데이터가 표시됩니다 (/api/sync/notion)</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  <TH>업체명</TH>
                  <TH>유형</TH>
                  <TH>상태</TH>
                  <TH>점수</TH>
                  <TH>키맨</TH>
                  <TH>연락처</TH>
                  <TH>링크</TH>
                  <TH>메모</TH>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {filtered.map((row) => (
                  <tr key={row.id} className={`group border-l-[3px] transition-all hover:bg-[#faf8ff] ${row.is_checked ? "border-l-violet-500 bg-violet-50/30" : "border-l-transparent hover:border-l-violet-500"}`}>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {row.is_checked && <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />}
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]"><TypeTags types={row.types} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge value={row.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><ScoreBadge value={row.score} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{row.keyman ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{row.contact ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.link
                        ? <a href={row.link} target="_blank" rel="noreferrer" className="text-xs text-violet-500 hover:underline">링크</a>
                        : <span className="text-slate-200">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px] truncate">{row.memo ?? <span className="text-slate-200">—</span>}</td>
                    <td className="px-3 py-3">
                      <KebabMenu onEdit={() => setModalRow(row)} onDelete={() => handleDelete(row.id, row.name)} />
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
