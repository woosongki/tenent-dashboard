"use client";

import { useRef, useState, useTransition } from "react";
import { createGoal } from "@/lib/goals/actions";
import { CATEGORY_LABELS, PERIOD_LABELS, POOL_TYPE_LABELS } from "@/types/goals";
import type { GoalCategory, GoalPeriod, PoolType } from "@/types/goals";

interface Props {
  organizationId: string;
  poolType: PoolType;
}

export default function AddGoalForm({ organizationId, poolType }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const targetValue = Number(fd.get("targetValue"));
    const startDate   = fd.get("startDate") as string;
    const endDate     = fd.get("endDate") as string;

    if (targetValue <= 0) { setError("목표값은 0보다 커야 합니다."); return; }
    if (startDate > endDate) { setError("마감일이 시작일보다 빠를 수 없습니다."); return; }

    startTransition(async () => {
      const result = await createGoal({
        organizationId,
        title:        fd.get("title") as string,
        description:  fd.get("description") as string || undefined,
        category:     fd.get("category") as GoalCategory,
        poolType,
        targetValue,
        currentValue: Number(fd.get("currentValue") ?? 0),
        unit:         fd.get("unit") as string,
        period:       fd.get("period") as GoalPeriod,
        startDate,
        endDate,
      });

      if (!result.ok) { setError(result.error); return; }
      formRef.current?.reset();
      setOpen(false);
    });
  }

  // 오늘 ~ 이번 달 말 기본값
  const today    = new Date().toISOString().slice(0, 10);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString().slice(0, 10);

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider px-4 py-2 border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] transition-all"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {POOL_TYPE_LABELS[poolType]} 추가
      </button>

      {/* 모달 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg brutal-lg bg-white">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-6 py-4">
              <h2 className="font-display text-[18px] leading-none text-[#0a0a0a]">
                {POOL_TYPE_LABELS[poolType]} 항목 추가
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-yellow-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 폼 */}
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {/* 목표명 */}
              <Field label="목표명" required>
                <input name="title" type="text" required placeholder="예: 월 신규 가입자 500명"
                  className={inputCls} />
              </Field>

              {/* 카테고리 + 기간 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="카테고리" required>
                  <select name="category" required className={inputCls}>
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="측정 기간" required>
                  <select name="period" required className={inputCls}>
                    {Object.entries(PERIOD_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* 목표값 + 현재값 + 단위 */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="목표값" required>
                  <input name="targetValue" type="number" required min={0.01} step="any"
                    placeholder="100" className={inputCls} />
                </Field>
                <Field label="현재값">
                  <input name="currentValue" type="number" min={0} step="any"
                    defaultValue={0} className={inputCls} />
                </Field>
                <Field label="단위">
                  <input name="unit" type="text" placeholder="%, 명, $" className={inputCls} />
                </Field>
              </div>

              {/* 시작일 + 마감일 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="시작일" required>
                  <input name="startDate" type="date" required defaultValue={today} className={inputCls} />
                </Field>
                <Field label="마감일" required>
                  <input name="endDate" type="date" required defaultValue={monthEnd} className={inputCls} />
                </Field>
              </div>

              {/* 설명 (optional) */}
              <Field label="설명">
                <textarea name="description" rows={2} placeholder="목표에 대한 부가 설명 (선택)"
                  className={`${inputCls} resize-none`} />
              </Field>

              {/* 에러 */}
              {error && (
                <p className="border-[2px] border-[#0a0a0a] bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>
              )}

              {/* 버튼 */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[12px] font-extrabold uppercase tracking-wider px-4 py-2 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-yellow-300 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="text-[12px] font-extrabold uppercase tracking-wider px-4 py-2 border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] disabled:opacity-50 transition-all"
                >
                  {isPending ? "저장 중…" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls =
  "w-full border-[2px] border-[#0a0a0a] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-[#0a0a0a]/30 shadow-[2px_2px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_0_#0a0a0a] transition-all";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a]">
        {label}{required && <span className="ml-0.5 text-rose-600">*</span>}
      </label>
      {children}
    </div>
  );
}
