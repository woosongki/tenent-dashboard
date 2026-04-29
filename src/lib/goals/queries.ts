import { createClient } from "@/lib/supabase/server";
import type { Goal } from "@/types/goals";

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

export async function getGoals(organizationId: string): Promise<Goal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(rowToGoal);
}
