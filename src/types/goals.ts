export type GoalCategory = "revenue" | "growth" | "retention" | "engagement" | "cost" | "custom";
export type GoalPeriod   = "monthly" | "quarterly" | "yearly";
export type GoalStatus   = "on_track" | "at_risk" | "behind" | "completed" | "cancelled";

export interface Goal {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  targetValue: number;
  currentValue: number;
  unit: string;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  status: GoalStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** InlineEditCell이 수정할 수 있는 필드 */
export type GoalEditableField = "title" | "currentValue" | "targetValue" | "description";

export interface UpdateGoalPayload {
  id: string;
  field: GoalEditableField;
  value: string | number;
}

export interface CreateGoalPayload {
  organizationId: string;
  title: string;
  description?: string;
  category: GoalCategory;
  targetValue: number;
  currentValue?: number;
  unit: string;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
}

export type GoalActionResult =
  | { ok: true; goal: Goal }
  | { ok: false; error: string };

export const CATEGORY_LABELS: Record<GoalCategory, string> = {
  revenue:    "매출",
  growth:     "성장",
  retention:  "유지율",
  engagement: "참여",
  cost:       "비용",
  custom:     "기타",
};

export const PERIOD_LABELS: Record<GoalPeriod, string> = {
  monthly:   "월간",
  quarterly: "분기",
  yearly:    "연간",
};

export const STATUS_META: Record<GoalStatus, { label: string; className: string }> = {
  on_track:  { label: "정상",  className: "bg-emerald-100 text-emerald-700" },
  at_risk:   { label: "위험",  className: "bg-amber-100  text-amber-700"   },
  behind:    { label: "지연",  className: "bg-rose-100   text-rose-700"    },
  completed: { label: "달성",  className: "bg-indigo-100 text-indigo-700"  },
  cancelled: { label: "취소",  className: "bg-gray-100   text-gray-500"    },
};
