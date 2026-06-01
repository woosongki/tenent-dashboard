"use client";

import { useState, useTransition, useMemo } from "react";
import type { Goal, GoalCategory, GoalStatus } from "@/types/goals";
import { CATEGORY_LABELS, PERIOD_LABELS, STATUS_META } from "@/types/goals";
import { deleteGoal, updateGoalStatus } from "@/lib/goals/actions";
import { useFilterBar } from "@/hooks/useFilterBar";
import FilterBar from "@/components/ui/FilterBar";
import ExportButton from "@/components/ui/ExportButton";
import type { FilterDef } from "@/types/filterBar";
import type { ExcelColumn } from "@/lib/excel";
import InlineEditCell from "./InlineEditCell";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// ── Excel 컬럼 정의 ───────────────────────────────────────────
const EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "목표명",    key: "title",        width: 28 },
  { header: "카테고리",  key: "category",     width: 12, format: (v) => CATEGORY_LABELS[v as GoalCategory] },
  { header: "현재값",    key: "currentValue", width: 12 },
  { header: "목표값",    key: "targetValue",  width: 12 },
  { header: "달성률(%)", key: "progress",     width: 12 },
  { header: "기간",      key: "period",       width: 10, format: (v) => PERIOD_LABELS[v as keyof typeof PERIOD_LABELS] },
  { header: "시작일",    key: "startDate",    width: 14 },
  { header: "마감일",    key: "endDate",      width: 14 },
  { header: "상태",      key: "status",       width: 10, format: (v) => STATUS_META[v as GoalStatus].label },
];

// ── FilterDef 상수 ────────────────────────────────────────────
const FILTER_DEFS: FilterDef[] = [
  { type: "text",   key: "q",        label: "검색",     placeholder: "목표명 검색…", debounceMs: 250 },
  { type: "select", key: "category", label: "카테고리", placeholder: "전체 카테고리",
    options: Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l })) },
  { type: "select", key: "status",   label: "상태",     placeholder: "전체 상태",
    options: Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
];

type SortKey = "title" | "category" | "progress" | "status" | "endDate";
type SortDir = "asc" | "desc";

const SORT_DEFS: FilterDef[] = [
  { type: "select", key: "sortKey", label: "정렬", placeholder: "기본 정렬", options: [] },
  { type: "select", key: "sortDir", label: "방향", placeholder: "", options: [] },
];

interface Props {
  goals: Goal[];
}

export default function GoalsTable({ goals: initialGoals }: Props) {
  const [goals, setGoals]   = useState(initialGoals);
  const [, startTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filterBar = useFilterBar(FILTER_DEFS);
  const sortBar   = useFilterBar(SORT_DEFS);
  const sortKey   = (sortBar.values.sortKey as SortKey) || "endDate";
  const sortDir   = (sortBar.values.sortDir as SortDir) || "asc";

  function handleSort(key: SortKey) {
    const nextDir: SortDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    sortBar.setMany({ sortKey: key, sortDir: nextDir });
  }

  function handleDelete(id: string) {
    setPendingDelete(id);
  }

  function doDelete(id: string) {
    setPendingDelete(null);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    startTransition(async () => {
      const res = await deleteGoal(id);
      if (!res.ok) setGoals(initialGoals);
    });
  }

  function handleStatusChange(id: string, status: GoalStatus) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    startTransition(async () => {
      const res = await updateGoalStatus(id, status);
      if (!res.ok) setGoals(initialGoals);
    });
  }

  const filtered = useMemo(() => {
    const q        = filterBar.values.q?.toLowerCase() ?? "";
    const category = filterBar.values.category ?? "";
    const status   = filterBar.values.status   ?? "";

    return goals
      .filter((g) => !q        || g.title.toLowerCase().includes(q))
      .filter((g) => !category || g.category === category)
      .filter((g) => !status   || g.status   === status)
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "title")    cmp = a.title.localeCompare(b.title, "ko");
        if (sortKey === "category") cmp = a.category.localeCompare(b.category);
        if (sortKey === "status")   cmp = a.status.localeCompare(b.status);
        if (sortKey === "endDate")  cmp = a.endDate.localeCompare(b.endDate);
        if (sortKey === "progress") {
          const pa = a.targetValue ? a.currentValue / a.targetValue : 0;
          const pb = b.targetValue ? b.currentValue / b.targetValue : 0;
          cmp = pa - pb;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [goals, filterBar.values, sortKey, sortDir]);

  const excelRows = useMemo(
    () => filtered.map((g) => ({
      ...g,
      progress: g.targetValue ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
    })) as Record<string, unknown>[],
    [filtered],
  );

  const SortTh = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      onClick={() => handleSort(k)}
      className="cursor-pointer select-none px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] hover:text-[#0a0a0a]/80 whitespace-nowrap"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === k && (
          <span className="text-violet-500">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* FilterBar */}
      <div className=" border-[2px] border-[#0a0a0a] bg-white px-4 py-3">
        <FilterBar
          defs={FILTER_DEFS}
          bar={filterBar}
          trailing={
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#0a0a0a]/55 font-medium">
                {filtered.length} / {goals.length}개 목표
              </span>
              <ExportButton filename="goals" columns={EXCEL_COLUMNS} rows={excelRows} />
            </div>
          }
        />
      </div>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <EmptyState hasFilter={filterBar.activeCount > 0} onReset={filterBar.reset} />
      ) : (
        <div className="overflow-hidden brutal bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#0a0a0a]/10 bg-[#F1ECDB]">
                  <SortTh label="목표명"   k="title"    />
                  <SortTh label="카테고리" k="category" />
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] whitespace-nowrap">현재값</th>
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] whitespace-nowrap">목표값</th>
                  <SortTh label="달성률"   k="progress" />
                  <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] whitespace-nowrap">기간</th>
                  <SortTh label="마감일"   k="endDate"  />
                  <SortTh label="상태"     k="status"   />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {filtered.map((goal) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="목표 삭제"
        message="목표를 삭제하시겠습니까?"
        confirmLabel="삭제"
        tone="danger"
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ── GoalRow ───────────────────────────────────────────────────

function GoalRow({
  goal,
  onDelete,
  onStatusChange,
}: {
  goal: Goal;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
}) {
  const pct = goal.targetValue
    ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
    : 0;

  const daysLeft = Math.ceil(
    (new Date(goal.endDate).getTime() - Date.now()) / 86_400_000,
  );

  return (
    <tr className="group transition-colors hover:bg-yellow-100">
      <td className="px-2 py-2.5 min-w-[160px] max-w-[240px]">
        <InlineEditCell goalId={goal.id} field="title" value={goal.title} type="text" />
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <CategoryBadge category={goal.category} />
      </td>
      <td className="px-2 py-2.5 min-w-[100px]">
        <InlineEditCell
          goalId={goal.id} field="currentValue" value={goal.currentValue}
          type="number" unit={goal.unit} min={0}
          format={(v) => Number(v).toLocaleString()}
        />
      </td>
      <td className="px-2 py-2.5 min-w-[100px]">
        <InlineEditCell
          goalId={goal.id} field="targetValue" value={goal.targetValue}
          type="number" unit={goal.unit} min={0.01}
          format={(v) => Number(v).toLocaleString()}
        />
      </td>
      <td className="px-4 py-2.5 min-w-[140px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 border-[1.5px] border-[#0a0a0a] bg-white overflow-hidden">
            <div
              className={`h-full transition-all ${progressColor(pct, goal.status)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-semibold tabular-nums text-[#0a0a0a]/80">{pct}%</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-[#0a0a0a]/55 font-medium whitespace-nowrap">
        {PERIOD_LABELS[goal.period]}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className={`text-xs ${daysLeft < 7 && goal.status !== "completed" ? "font-semibold text-rose-500" : "text-[#0a0a0a]/55 font-medium"}`}>
          {new Date(goal.endDate).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
        </span>
        {daysLeft >= 0 && goal.status !== "completed" && (
          <span className="ml-1 text-xs text-[#0a0a0a]/25">D-{daysLeft}</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <StatusSelect value={goal.status} onChange={(s) => onStatusChange(goal.id, s)} />
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={() => onDelete(goal.id)}
          className="rounded-md p-1.5 text-[#0a0a0a]/25 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
          title="삭제"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

// ── Sub-components ────────────────────────────────────────────

function progressColor(pct: number, status: GoalStatus): string {
  if (status === "completed") return "bg-violet-500";
  if (status === "cancelled") return "bg-slate-300";
  if (pct >= 100) return "bg-violet-500";
  if (pct >= 70)  return "bg-emerald-400";
  if (pct >= 40)  return "bg-amber-400";
  return "bg-rose-400";
}

function CategoryBadge({ category }: { category: GoalCategory }) {
  const colors: Record<GoalCategory, string> = {
    revenue:    "bg-emerald-50 text-emerald-700",
    growth:     "bg-violet-50  text-violet-700",
    retention:  "bg-fuchsia-50 text-fuchsia-700",
    engagement: "bg-sky-50     text-sky-700",
    cost:       "bg-amber-50   text-amber-700",
    custom:     "bg-slate-100  text-[#0a0a0a]/80",
  };
  return (
    <span className={`inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider ${colors[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function StatusSelect({ value, onChange }: { value: GoalStatus; onChange: (s: GoalStatus) => void }) {
  const m = STATUS_META[value];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as GoalStatus)}
        className={`cursor-pointer appearance-none rounded-full px-2.5 py-0.5 pr-6 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300 ${m.className}`}
      >
        {Object.entries(STATUS_META).map(([v, meta]) => (
          <option key={v} value={v}>{meta.label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function EmptyState({ hasFilter, onReset }: { hasFilter: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center  border-[2px] border-[#0a0a0a] bg-white py-16 text-center">
      <svg className="mb-3 h-10 w-10 text-[#0a0a0a]/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <p className="text-sm font-medium text-[#0a0a0a]/55 font-medium">
        {hasFilter ? "조건에 맞는 목표가 없습니다" : "목표가 없습니다"}
      </p>
      {hasFilter ? (
        <button onClick={onReset} className="mt-2 text-xs text-violet-500 hover:underline">
          필터 초기화
        </button>
      ) : (
        <p className="mt-1 text-xs text-[#0a0a0a]/30">상단 버튼으로 첫 목표를 추가해보세요.</p>
      )}
    </div>
  );
}
