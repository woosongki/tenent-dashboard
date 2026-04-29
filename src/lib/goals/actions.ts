"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Goal,
  GoalActionResult,
  UpdateGoalPayload,
  CreateGoalPayload,
} from "@/types/goals";

function rowToGoal(r: Record<string, unknown>): Goal {
  return {
    id:             r.id as string,
    organizationId: r.organization_id as string,
    title:          r.title as string,
    description:    r.description as string | null,
    category:       r.category as Goal["category"],
    targetValue:    Number(r.target_value),
    currentValue:   Number(r.current_value),
    unit:           r.unit as string,
    period:         r.period as Goal["period"],
    startDate:      r.start_date as string,
    endDate:        r.end_date as string,
    status:         r.status as Goal["status"],
    createdBy:      r.created_by as string,
    createdAt:      r.created_at as string,
    updatedAt:      r.updated_at as string,
  };
}

/** 단일 필드 인라인 수정 */
export async function updateGoalField(
  payload: UpdateGoalPayload,
): Promise<GoalActionResult> {
  const supabase = await createClient();

  // DB 컬럼명으로 변환
  const colMap: Record<string, string> = {
    title:        "title",
    description:  "description",
    currentValue: "current_value",
    targetValue:  "target_value",
  };
  const col = colMap[payload.field];
  if (!col) return { ok: false, error: "수정 불가 필드입니다." };

  // 숫자 필드 유효성 검사
  if (["currentValue", "targetValue"].includes(payload.field)) {
    const num = Number(payload.value);
    if (isNaN(num) || num < 0) return { ok: false, error: "유효하지 않은 숫자입니다." };
    if (payload.field === "targetValue" && num === 0) return { ok: false, error: "목표값은 0보다 커야 합니다." };
  }

  const { data, error } = await supabase
    .from("goals")
    .update({ [col]: payload.value })
    .eq("id", payload.id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/goals");
  return { ok: true, goal: rowToGoal(data as Record<string, unknown>) };
}

/** 새 목표 생성 */
export async function createGoal(
  payload: CreateGoalPayload,
): Promise<GoalActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "인증이 필요합니다." };

  const { data, error } = await supabase
    .from("goals")
    .insert({
      organization_id: payload.organizationId,
      title:           payload.title,
      description:     payload.description ?? null,
      category:        payload.category,
      target_value:    payload.targetValue,
      current_value:   payload.currentValue ?? 0,
      unit:            payload.unit,
      period:          payload.period,
      start_date:      payload.startDate,
      end_date:        payload.endDate,
      created_by:      user.id,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/goals");
  return { ok: true, goal: rowToGoal(data as Record<string, unknown>) };
}

/** 목표 삭제 */
export async function deleteGoal(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/goals");
  return { ok: true };
}

/** 상태 직접 변경 (완료/취소) */
export async function updateGoalStatus(
  id: string,
  status: Goal["status"],
): Promise<GoalActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/goals");
  return { ok: true, goal: rowToGoal(data as Record<string, unknown>) };
}
