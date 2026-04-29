"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/types/performance";

const ORG_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function calcGrowth(current: number | null, prev: number | null): number | null {
  if (current === null || prev === null || prev === 0) return null;
  return Math.round(((current - prev) / Math.abs(prev)) * 10000) / 100;
}

export interface RowFormData {
  category: string;
  brand_code: string;
  brand_name: string;
  revenue_current: string;
  revenue_prev: string;
  gross_profit_current: string;
  gross_profit_prev: string;
}

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function validate(data: RowFormData): string | null {
  if (!CATEGORIES.includes(data.category as never)) return "올바른 카테고리를 선택해주세요.";
  if (!data.brand_name.trim()) return "브랜드명을 입력해주세요.";
  return null;
}

export async function createBrandRow(data: RowFormData): Promise<{ error?: string }> {
  const err = validate(data);
  if (err) return { error: err };

  const rc = parseNum(data.revenue_current);
  const rp = parseNum(data.revenue_prev);
  const gc = parseNum(data.gross_profit_current);
  const gp = parseNum(data.gross_profit_prev);

  const supabase = await createClient();
  const { error } = await supabase.from("brand_performance").insert({
    organization_id: ORG_ID,
    category: data.category,
    brand_code: data.brand_code.trim() || null,
    brand_name: data.brand_name.trim(),
    row_type: "brand",
    revenue_current: rc,
    revenue_prev: rp,
    revenue_growth: calcGrowth(rc, rp),
    gross_profit_current: gc,
    gross_profit_prev: gp,
    gross_profit_growth: calcGrowth(gc, gp),
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales");
  return {};
}

export async function updateBrandRow(id: string, data: RowFormData): Promise<{ error?: string }> {
  const err = validate(data);
  if (err) return { error: err };

  const rc = parseNum(data.revenue_current);
  const rp = parseNum(data.revenue_prev);
  const gc = parseNum(data.gross_profit_current);
  const gp = parseNum(data.gross_profit_prev);

  const supabase = await createClient();
  const { error } = await supabase.from("brand_performance").update({
    category: data.category,
    brand_code: data.brand_code.trim() || null,
    brand_name: data.brand_name.trim(),
    revenue_current: rc,
    revenue_prev: rp,
    revenue_growth: calcGrowth(rc, rp),
    gross_profit_current: gc,
    gross_profit_prev: gp,
    gross_profit_growth: calcGrowth(gc, gp),
  }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales");
  return {};
}

export async function deleteBrandRow(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_performance").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales");
  return {};
}
