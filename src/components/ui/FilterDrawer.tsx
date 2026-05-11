"use client";

import { useState, useEffect } from "react";

interface Props {
  /** 활성화된 필터 개수 (뱃지 표시용) */
  activeCount: number;
  children: React.ReactNode;
  /** 데스크톱에서는 inline으로 보이게 할지 (기본: true) */
  desktopInline?: boolean;
}

/**
 * 모바일에서는 "필터" 버튼 → 바닥 드로어
 * 데스크톱(`md:` 이상)에서는 inline children 표시
 */
export default function FilterDrawer({ activeCount, children, desktopInline = true }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* ── 모바일: 트리거 버튼 ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center gap-1.5 rounded-lg border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
        </svg>
        필터
        {activeCount > 0 && (
          <span className="ml-0.5 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {activeCount}
          </span>
        )}
      </button>

      {/* ── 데스크톱: inline ── */}
      {desktopInline && <div className="hidden md:contents">{children}</div>}

      {/* ── 모바일: 바닥 드로어 ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl bg-white p-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">필터</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="rounded-md p-1 text-slate-400 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {children}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </>
  );
}
