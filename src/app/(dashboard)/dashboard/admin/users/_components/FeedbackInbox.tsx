"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setFeedbackStatus, deleteFeedback } from "@/app/(dashboard)/_actions/feedback";
import { type Feedback, type FeedbackStatus, FEEDBACK_STATUS_LABEL } from "@/lib/feedback";

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: "bg-yellow-300 text-[#0a0a0a]",
  seen: "bg-sky-200 text-sky-900",
  done: "bg-emerald-300 text-emerald-950",
};

const FILTERS: [FeedbackStatus | "all", string][] = [
  ["all", "전체"], ["new", "신규"], ["seen", "확인"], ["done", "완료"],
];

export default function FeedbackInbox({ items }: { items: Feedback[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [pending, startTransition] = useTransition();

  const rows = useMemo(
    () => (filter === "all" ? items : items.filter((f) => f.status === filter)),
    [items, filter],
  );
  const newCount = items.filter((f) => f.status === "new").length;

  function changeStatus(id: string, status: FeedbackStatus) {
    startTransition(async () => {
      const res = await setFeedbackStatus(id, status);
      if (res.ok) router.refresh(); else toast.error(res.error);
    });
  }
  function remove(id: string) {
    if (!confirm("이 의견을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await deleteFeedback(id);
      if (res.ok) { toast.success("삭제됨"); router.refresh(); } else toast.error(res.error);
    });
  }

  return (
    <section className="brutal bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-extrabold">팀 의견함</h2>
          {newCount > 0 && (
            <span className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-2 py-0.5 text-[11px] font-extrabold">신규 {newCount}</span>
          )}
          <span className="text-[11px] text-slate-400">· 관리자만 볼 수 있습니다</span>
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`border-[2px] border-[#0a0a0a] px-3 py-1 text-[12px] font-bold transition ${filter === k ? "bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-yellow-50"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border-[2px] border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-400">
          {filter === "all" ? "아직 접수된 의견이 없습니다." : "해당 상태의 의견이 없습니다."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((f) => (
            <div key={f.id} className="border-[2px] border-[#0a0a0a] bg-[#FAF7EC] p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`border-[2px] border-[#0a0a0a] px-1.5 py-0.5 font-extrabold ${STATUS_STYLE[f.status]}`}>{FEEDBACK_STATUS_LABEL[f.status]}</span>
                {f.category && <span className="border border-slate-400 px-1.5 py-0.5 font-bold text-slate-600">{f.category}</span>}
                <span className="font-mono text-slate-500">{f.authorEmail ?? "익명"}</span>
                <span className="text-slate-400">{f.createdAt.slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#0a0a0a]">{f.message}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.status !== "seen" && <ActBtn onClick={() => changeStatus(f.id, "seen")} disabled={pending}>확인</ActBtn>}
                {f.status !== "done" && <ActBtn onClick={() => changeStatus(f.id, "done")} disabled={pending}>완료</ActBtn>}
                {f.status !== "new" && <ActBtn onClick={() => changeStatus(f.id, "new")} disabled={pending}>신규로</ActBtn>}
                <button onClick={() => remove(f.id)} disabled={pending}
                  className="ml-auto border-[2px] border-rose-500 px-2 py-0.5 text-[12px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ActBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="border-[2px] border-[#0a0a0a] bg-white px-2 py-0.5 text-[12px] font-bold hover:bg-yellow-50 disabled:opacity-50">{children}</button>
  );
}
