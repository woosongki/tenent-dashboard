"use client";

import { useId } from "react";
import type { FilterDef, UseFilterBarReturn } from "@/types/filterBar";

interface Props {
  defs: FilterDef[];
  bar: UseFilterBarReturn;
  /** 오른쪽에 추가로 표시할 노드 (결과 수 등) */
  trailing?: React.ReactNode;
}

export default function FilterBar({ defs, bar, trailing }: Props) {
  const { values, set, reset, activeCount, isPending } = bar;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 transition-opacity ${
        isPending ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {defs.map((def) => (
        <FilterInput key={def.type === "daterange" ? def.fromKey : def.key} def={def} values={values} set={set} />
      ))}

      {/* 초기화 버튼 */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <XIcon />
          초기화
          <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
            {activeCount}
          </span>
        </button>
      )}

      {/* 로딩 스피너 */}
      {isPending && <SpinnerIcon />}

      {/* trailing 슬롯 — 모바일에서 full-width 별도 줄, sm 이상에서 우측 정렬 */}
      {trailing && (
        <div className="flex w-full items-center justify-between sm:ml-auto sm:w-auto sm:justify-end">
          {trailing}
        </div>
      )}
    </div>
  );
}

// ── 개별 필터 입력 ──────────────────────────────────────────

function FilterInput({
  def,
  values,
  set,
}: {
  def: FilterDef;
  values: Record<string, string>;
  set: UseFilterBarReturn["set"];
}) {
  const id = useId();

  if (def.type === "select") {
    const { key, placeholder, options } = def;
    return (
      <div className="relative">
        <select
          id={id}
          value={values[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
          className={selectCls(!!values[key])}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {/* 활성 필터 강조 도트 */}
        {values[key] && (
          <span className="pointer-events-none absolute right-5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-indigo-500" />
        )}
      </div>
    );
  }

  if (def.type === "text") {
    const { key, placeholder, debounceMs = 300 } = def;
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300">
          <SearchIcon />
        </span>
        <input
          id={id}
          type="text"
          defaultValue={values[key] ?? ""}
          placeholder={placeholder ?? "검색…"}
          onChange={(e) => set(key, e.target.value, debounceMs)}
          className={`${inputCls} pl-7 pr-3 ${values[key] ? "border-indigo-300 bg-indigo-50" : ""}`}
        />
      </div>
    );
  }

  if (def.type === "daterange") {
    const { fromKey, toKey } = def;
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={values[fromKey] ?? ""}
          onChange={(e) => set(fromKey, e.target.value)}
          className={`${inputCls} ${values[fromKey] ? "border-indigo-300 bg-indigo-50" : ""}`}
          title="시작일"
        />
        <span className="text-xs text-gray-300">–</span>
        <input
          type="date"
          value={values[toKey] ?? ""}
          onChange={(e) => set(toKey, e.target.value)}
          className={`${inputCls} ${values[toKey] ? "border-indigo-300 bg-indigo-50" : ""}`}
          title="종료일"
        />
      </div>
    );
  }

  return null;
}

// ── 스타일 헬퍼 ─────────────────────────────────────────────

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors";

function selectCls(active: boolean) {
  return (
    `${inputCls} cursor-pointer appearance-none pr-7 ` +
    (active ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-700" : "")
  );
}

// ── 아이콘 ─────────────────────────────────────────────────

function XIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
