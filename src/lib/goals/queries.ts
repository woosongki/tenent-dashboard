import { createClient } from "@/lib/supabase/server";
import type { Goal, PoolType } from "@/types/goals";

function rowToGoal(r: Record<string, unknown>): Goal {
  return {
    id:             r.id as string,
    organizationId: r.organization_id as string,
    title:          r.title as string,
    description:    r.description as string | null,
    category:       r.category as Goal["category"],
    poolType:       (r.pool_type as PoolType) ?? "lifestyle",
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

export async function getGoals(
  organizationId: string,
  poolType?: PoolType,
): Promise<Goal[]> {
  const supabase = await createClient();
  let query = supabase
    .from("goals")
    .select("id, organization_id, title, description, category, pool_type, target_value, current_value, unit, period, start_date, end_date, status, created_by, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (poolType) query = query.eq("pool_type", poolType);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(rowToGoal);
}
