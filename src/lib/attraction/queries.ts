import { createClient } from "@/lib/supabase/server";
import type { AttractionRow } from "@/types/attraction";

export async function getAttractionRows(): Promise<AttractionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attraction_status")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as AttractionRow[];
}

export async function getAttractionStats(): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  byCategory: Record<string, number>;
}> {
  const rows = await getAttractionRows();
  const completed = rows.filter((r) => r.is_completed).length;
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    const cat = r.category ?? "기타";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  return { total: rows.length, completed, inProgress: rows.length - completed, byCategory };
}
