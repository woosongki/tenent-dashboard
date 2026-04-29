"use client";

import {
  useRef,
  useState,
  useTransition,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from "react";
import { updateGoalField } from "@/lib/goals/actions";
import type { GoalEditableField } from "@/types/goals";

type InputType = "text" | "number";

interface Props {
  goalId: string;
  field: GoalEditableField;
  value: string | number;
  type?: InputType;
  /** 숫자 필드에 붙는 단위 (ex: "%", "$") */
  unit?: string;
  /** 숫자 최솟값 */
  min?: number;
  /** 표시 포맷 함수. 뷰 모드에서만 적용 */
  format?: (v: string | number) => string;
  className?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function InlineEditCell({
  goalId,
  field,
  value: initialValue,
  type = "text",
  unit,
  min,
  format,
  className = "",
}: Props) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(String(initialValue));
  const [current, setCurrent]   = useState(initialValue);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition]     = useTransition();

  // 외부에서 value가 바뀌면 반영 (서버 revalidate 후)
  useEffect(() => {
    if (!editing) {
      setCurrent(initialValue);
      setDraft(String(initialValue));
    }
  }, [initialValue, editing]);

  const openEdit = useCallback(() => {
    setDraft(String(current));
    setSaveState("idle");
    setErrorMsg("");
    setEditing(true);
  }, [current]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(String(current));
    setSaveState("idle");
  }, [current]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();

    // 변경 없으면 그냥 닫기
    if (trimmed === String(current)) {
      setEditing(false);
      return;
    }

    // 빈 값 방지 (text 필드)
    if (type === "text" && trimmed === "") {
      setErrorMsg("값을 입력해주세요.");
      setSaveState("error");
      return;
    }

    // 숫자 유효성
    if (type === "number") {
      const num = Number(trimmed);
      if (isNaN(num)) { setErrorMsg("숫자를 입력해주세요."); setSaveState("error"); return; }
      if (min !== undefined && num < min) { setErrorMsg(`최솟값은 ${min}입니다.`); setSaveState("error"); return; }
    }

    const optimisticValue: string | number = type === "number" ? Number(trimmed) : trimmed;

    // Optimistic update
    setCurrent(optimisticValue);
    setEditing(false);
    setSaveState("saving");

    startTransition(async () => {
      const result = await updateGoalField({
        id: goalId,
        field,
        value: optimisticValue,
      });

      if (!result.ok) {
        // 롤백
        setCurrent(initialValue);
        setDraft(String(initialValue));
        setSaveState("error");
        setErrorMsg(result.error);
      } else {
        setSaveState("saved");
        // 2초 후 idle
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      }
    });
  }, [draft, current, type, min, goalId, field, initialValue]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter")  { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    },
    [commit, cancel],
  );

  const displayValue = format ? format(current) : String(current);

  // ── 편집 모드 ─────────────────────────────────────────────
  if (editing) {
    return (
      <div className="relative flex items-center gap-1">
        <input
          ref={inputRef}
          type={type}
          value={draft}
          min={min}
          onChange={(e) => { setDraft(e.target.value); setSaveState("idle"); setErrorMsg(""); }}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className={`
            w-full rounded-md border px-2 py-1 text-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-400
            ${saveState === "error"
              ? "border-rose-400 bg-rose-50 focus:ring-rose-300"
              : "border-indigo-300 bg-white"
            }
            ${className}
          `}
        />
        {unit && (
          <span className="shrink-0 text-xs text-gray-400">{unit}</span>
        )}
        {/* 에러 툴팁 */}
        {saveState === "error" && errorMsg && (
          <div className="absolute -bottom-7 left-0 z-20 whitespace-nowrap rounded-md bg-rose-600 px-2 py-1 text-xs text-white shadow-lg">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  // ── 뷰 모드 ──────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={openEdit}
      title="클릭하여 편집"
      className={`
        group relative flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm
        transition-colors hover:bg-indigo-50
        ${saveState === "error" ? "text-rose-600" : "text-gray-800"}
        ${className}
      `}
    >
      <span className="truncate">{displayValue}</span>
      {unit && <span className="text-xs text-gray-400">{unit}</span>}

      {/* 상태 아이콘 */}
      <span className="ml-auto shrink-0">
        {saveState === "saving" && <SpinnerIcon />}
        {saveState === "saved"  && <CheckIcon />}
        {saveState === "error"  && <ErrorIcon />}
        {saveState === "idle"   && <PencilIcon />}
      </span>
    </button>
  );
}

// ── 아이콘 ────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-gray-300 opacity-0 transition group-hover:opacity-100"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}
