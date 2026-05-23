import { createClient } from "@/lib/supabase/server";

export interface Floorplan {
  id: string;
  store_id: string;
  floor_label: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 층 라벨로부터 정렬 순서 계산: B2=-2, B1=-1, 1F=1, 2F=2 ... RF=99 */
export function computeSortOrder(label: string): number {
  const trimmed = label.trim().toUpperCase();
  if (trimmed === "RF" || trimmed === "옥상" || trimmed === "ROOF") return 99;
  const bMatch = trimmed.match(/^B\s*(\d+)/);
  if (bMatch) return -Number(bMatch[1]);
  const fMatch = trimmed.match(/^(\d+)/);
  if (fMatch) return Number(fMatch[1]);
  return 1000;
}

export async function getAllFloorplansGrouped(): Promise<Record<string, Floorplan[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floorplans")
    .select("id, store_id, floor_label, storage_path, public_url, mime_type, size_bytes, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("floor_label", { ascending: true });
  if (error || !data) return {};
  const grouped: Record<string, Floorplan[]> = {};
  for (const row of data as Floorplan[]) {
    (grouped[row.store_id] ??= []).push(row);
  }
  return grouped;
}
