"use client";

// 재사용 확인 다이얼로그 — 브라우저 기본 confirm() 대체 (Neo-Brutalist 스타일).
//
// 사용 (제어 컴포넌트):
//   const [pending, setPending] = useState<null | {...}>(null);
//   <ConfirmDialog
//     open={pending !== null}
//     title="..."
//     message="..."
//     onConfirm={() => { ...; setPending(null); }}
//     onCancel={() => setPending(null)}
//   />

import { useEffect } from "react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmBg = tone === "danger" ? "bg-red-400" : "bg-yellow-300";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[400px] border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[8px_8px_0_0_#0a0a0a]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[20px] leading-tight text-[#0a0a0a]">{title}</h2>
        {message && <p className="mt-2 text-[13px] text-slate-600">{message}</p>}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onConfirm}
            autoFocus
            className={`flex-1 border-[3px] border-[#0a0a0a] ${confirmBg} py-2.5 font-display text-[15px] text-[#0a0a0a] shadow-[4px_4px_0_0_#0a0a0a] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#0a0a0a]`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="border-[3px] border-[#0a0a0a] bg-white px-5 py-2.5 font-bold text-[#0a0a0a] transition hover:bg-slate-100"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
