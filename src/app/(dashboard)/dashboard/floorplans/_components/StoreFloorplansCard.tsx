"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import type { Floorplan } from "@/lib/floorplans/queries";
import type { Store } from "@/lib/stores";
import { uploadFloorplan, deleteFloorplan } from "@/lib/floorplans/actions";

interface Props {
  store: Store;
  brandColor?: { bg: string; text: string; hex: string };
  initialFloors: Floorplan[];
}

export default function StoreFloorplansCard({ store, brandColor, initialFloors }: Props) {
  const [floors, setFloors] = useState<Floorplan[]>(initialFloors);
  const [adding, setAdding] = useState(false);
  const [viewer, setViewer] = useState<Floorplan | null>(null);

  function onUploaded(row: Floorplan) {
    setFloors((prev) => {
      // 같은 floor_label 있으면 교체, 없으면 추가 후 sort_order로 정렬
      const without = prev.filter((f) => f.floor_label !== row.floor_label);
      const next = [...without, row];
      next.sort((a, b) => (a.sort_order - b.sort_order) || a.floor_label.localeCompare(b.floor_label));
      return next;
    });
  }
  function onDeleted(id: string) {
    setFloors((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                brandColor?.bg ?? "bg-slate-50"
              } ${brandColor?.text ?? "text-slate-600"}`}
            >
              {store.brand}
            </span>
            <h3 className="truncate text-[14px] font-bold text-slate-800">{store.name}</h3>
            {store.hasKimsclub && (
              <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                킴스클럽
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{store.address}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">층 도면</p>
          <p className="text-[14px] font-bold tabular-nums text-slate-700">{floors.length}</p>
        </div>
      </div>

      {/* 층별 그리드 */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {floors.map((f) => (
          <FloorTile
            key={f.id}
            floor={f}
            onClick={() => setViewer(f)}
            onDelete={() => onDeleted(f.id)}
          />
        ))}

        {/* + 층 추가 타일 */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 text-slate-400 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-[10px] font-medium">층 추가</span>
        </button>
      </div>

      {/* storeId 표시 */}
      <div className="border-t border-[#f1f5f9] px-3 py-1.5 text-right">
        <code className="text-[9px] font-mono text-slate-300">{store.id}</code>
      </div>

      {/* 업로드 모달 */}
      {adding && (
        <UploadModal
          storeId={store.id}
          storeName={store.name}
          existingLabels={floors.map((f) => f.floor_label)}
          onClose={() => setAdding(false)}
          onSuccess={(row) => {
            onUploaded(row);
            setAdding(false);
          }}
        />
      )}

      {/* 뷰어 모달 */}
      {viewer && (
        <ViewerModal
          floor={viewer}
          storeName={store.name}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FloorTile — 한 층 미리보기 + 삭제 버튼
// ─────────────────────────────────────────────────────────────
function FloorTile({
  floor,
  onClick,
  onDelete,
}: {
  floor: Floorplan;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [, startTransition] = useTransition();
  const isPdf = floor.mime_type === "application/pdf";

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    toast(`"${floor.floor_label}" 도면을 삭제하시겠습니까?`, {
      action: {
        label: "삭제",
        onClick: () => {
          onDelete();
          startTransition(async () => {
            const res = await deleteFloorplan(floor.id);
            if (!res.ok) toast.error(res.error);
            else toast.success("삭제됐습니다.");
          });
        },
      },
      cancel: { label: "취소", onClick: () => {} },
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-[4/3] w-full overflow-hidden rounded-lg border border-[#e8ecf0] bg-slate-50 transition-all hover:border-violet-300 hover:shadow-md"
    >
      {isPdf ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-rose-50/50">
          <svg className="h-7 w-7 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            <text x="10" y="14" textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">PDF</text>
          </svg>
          <span className="text-[9px] text-slate-400">{Math.round(floor.size_bytes / 1024)}KB</span>
        </div>
      ) : (
        <img
          src={floor.public_url}
          alt={floor.floor_label}
          className="h-full w-full object-contain"
        />
      )}

      {/* 층 라벨 배지 */}
      <span className="absolute left-1.5 top-1.5 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
        {floor.floor_label}
      </span>

      {/* 삭제 버튼 (hover 시) */}
      <span
        role="button"
        tabIndex={0}
        onClick={handleDelete}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleDelete(e as unknown as React.MouseEvent); }}
        className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-md bg-rose-500 text-white opacity-0 shadow-sm transition-opacity group-hover:flex group-hover:opacity-100 hover:bg-rose-600"
        aria-label="삭제"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// UploadModal — 층 라벨 입력 + 파일 업로드
// ─────────────────────────────────────────────────────────────
function UploadModal({
  storeId,
  storeName,
  existingLabels,
  onClose,
  onSuccess,
}: {
  storeId: string;
  storeName: string;
  existingLabels: string[];
  onClose: () => void;
  onSuccess: (row: Floorplan) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [floorLabel, setFloorLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const QUICK_LABELS = ["B2", "B1", "1F", "2F", "3F", "4F", "5F", "6F", "7F", "8F", "9F", "10F", "RF"];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!floorLabel.trim()) { setError("층 라벨을 입력해주세요"); return; }
    if (!file) { setError("도면 파일을 선택해주세요"); return; }
    const replacing = existingLabels.includes(floorLabel.trim());

    const fd = new FormData();
    fd.set("storeId", storeId);
    fd.set("floorLabel", floorLabel.trim());
    fd.set("file", file);

    startTransition(async () => {
      const res = await uploadFloorplan(fd);
      if (!res.ok) { setError(res.error); return; }
      toast.success(replacing ? `${floorLabel} 도면이 교체됐습니다.` : `${floorLabel} 도면이 추가됐습니다.`);
      if (res.data) onSuccess(res.data);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e8ecf0] px-6 py-4 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">도면 추가</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{storeName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500 rounded-lg p-1">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* 층 라벨 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">층 라벨 *</label>
            <input
              type="text"
              value={floorLabel}
              onChange={(e) => setFloorLabel(e.target.value)}
              placeholder="예: B1, 1F, 2F, RF"
              className="w-full rounded-lg border border-[#e8ecf0] px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {QUICK_LABELS.map((l) => {
                const exists = existingLabels.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setFloorLabel(l)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      floorLabel === l
                        ? "bg-violet-600 text-white"
                        : exists
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                    title={exists ? "이미 등록된 층 — 클릭 시 교체" : ""}
                  >
                    {l}{exists && " ✓"}
                  </button>
                );
              })}
            </div>
            {floorLabel && existingLabels.includes(floorLabel) && (
              <p className="mt-1 text-[11px] text-amber-600">⚠ 기존 도면이 교체됩니다</p>
            )}
          </div>

          {/* 파일 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">도면 파일 *</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-slate-400 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600"
            >
              {file ? (
                <>
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs font-medium text-slate-700">{file.name}</p>
                  <p className="text-[10px] text-slate-400">{Math.round(file.size / 1024)}KB</p>
                </>
              ) : (
                <>
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <p className="text-xs font-medium">파일 선택 또는 드래그</p>
                  <p className="text-[10px] text-slate-300">PNG · JPG · WEBP · SVG · PDF (최대 20MB)</p>
                </>
              )}
            </button>
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-[#e8ecf0] px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">취소</button>
            <button type="submit" disabled={pending || !file || !floorLabel.trim()} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {pending && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {pending ? "업로드 중..." : "업로드"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ViewerModal — 도면 원본 보기
// ─────────────────────────────────────────────────────────────
function ViewerModal({
  floor,
  storeName,
  onClose,
}: {
  floor: Floorplan;
  storeName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const isPdf = floor.mime_type === "application/pdf";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[95vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e8ecf0] px-5 py-3 bg-white">
          <div>
            <p className="text-[11px] text-slate-400">{storeName}</p>
            <h2 className="text-sm font-bold text-slate-800">
              <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-700 mr-2">{floor.floor_label}</span>
              {Math.round(floor.size_bytes / 1024)}KB
            </h2>
          </div>
          <div className="flex gap-2">
            <a
              href={floor.public_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[#e8ecf0] px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              원본 다운로드
            </a>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50">
          {isPdf ? (
            <iframe src={floor.public_url} className="h-full w-full min-h-[70vh]" title={floor.floor_label} />
          ) : (
            <img
              src={floor.public_url}
              alt={floor.floor_label}
              className="mx-auto max-h-full max-w-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
