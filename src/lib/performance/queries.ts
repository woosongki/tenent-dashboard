import { createClient } from "@/lib/supabase/server";
import type { BrandPerformanceRow } from "@/types/performance";

export async function getPerformanceRows(): Promise<BrandPerformanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_performance")
    .select("*")
    .order("category")
    .order("row_type")
    .order("revenue_current", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as BrandPerformanceRow[];
}

export async function getPerformanceSummary(): Promise<BrandPerformanceRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_performance")
    .select("*")
    .eq("row_type", "total")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BrandPerformanceRow | null;
}

export async function getPerformanceByCategory(): Promise<BrandPerformanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_performance")
    .select("*")
    .eq("row_type", "subtotal")
    .order("revenue_current", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as BrandPerformanceRow[];
}
