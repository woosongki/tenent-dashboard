"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitFeedback } from "@/app/(dashboard)/_actions/feedback";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(FEEDBACK_CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  function send() {
    if (!message.trim()) { toast.error("내용을 입력하세요."); return; }
    startTransition(async () => {
      const res = await submitFeedback({ category, message });
      if (res.ok) {
        toast.success("의견이 전달되었습니다. 감사합니다!");
        setMessage(""); setCategory(FEEDBACK_CATEGORIES[0]); setOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="의견·개선 제안 보내기"
        className="fixed bottom-4 right-4 z-[1500] flex items-center gap-1.5 border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-2 text-[13px] font-bold text-[#0a0a0a] shadow-[3px_3px_0_0_#0a0a0a] transition hover:bg-yellow-400 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.84L3 20l1.1-3.3A7.93 7.93 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="hidden sm:inline">의견 보내기</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-[460px] border-[2px] border-[#0a0a0a] bg-white p-4" style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[15px] font-bold">의견 · 개선 제안</div>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <p className="mb-3 text-[12px] text-slate-500">불편한 점, 추가했으면 하는 기능 등 무엇이든 편하게 남겨주세요. 관리자가 확인합니다.</p>

            <label className="mb-1 block text-[11px] font-bold text-slate-600">분류</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {FEEDBACK_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`border-[2px] border-[#0a0a0a] px-2.5 py-1 text-[12px] font-bold transition ${category === c ? "bg-yellow-300" : "bg-white hover:bg-yellow-50"}`}>
                  {c}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-[11px] font-bold text-slate-600">내용</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000}
              placeholder="예: 매출분석 표를 엑셀로도 내려받고 싶어요."
              className="w-full resize-none border-[2px] border-[#0a0a0a] px-3 py-2 text-[13px] outline-none focus:bg-yellow-50" />

            <div className="mt-4 flex gap-2">
              <button onClick={send} disabled={pending}
                className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-4 py-1.5 text-[13px] font-bold hover:bg-yellow-400 disabled:opacity-50">
                {pending ? "전송 중…" : "보내기"}
              </button>
              <button onClick={() => setOpen(false)} className="ml-auto border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[13px] font-bold hover:bg-slate-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
