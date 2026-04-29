"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface AttractionFormData {
  brand_name: string;
  branch: string | null;
  floor: string | null;
  category: string | null;
  size_pyeong: number | null;
  manager: string | null;
  is_completed: boolean;
  memo: string | null;
  notion_url: string | null;
}

export async function upsertAttractionRow(
  id: string | null,
  data: AttractionFormData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("attraction_status")
      .update(data)
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("attraction_status")
      .insert(data);
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/drilldown");
  return {};
}

export async function deleteAttractionRow(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attraction_status")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/drilldown");
  return {};
}
