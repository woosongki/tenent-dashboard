"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// "X" = 제외(BCD 점수 분모에서 빠짐, 예: 팝업 브랜드)
const VALID = new Set(["S", "A", "B", "C", "F", "X", ""]);

/** 미분류/오분류 브랜드 등급을 앱에서 직접 지정 → brand_grade에 정확 브랜드명으로 upsert.
 *  전역 등급표라 이후 모든 BCD 화면·기간에 반영(revalidateTag("sales")). 관리자만. */
export async function setBrandGrade(brand: string, grade: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const b = brand?.trim();
  if (!b) return { ok: false, error: "브랜드명이 없습니다." };
  if (!VALID.has(grade)) return { ok: false, error: "등급 값이 올바르지 않습니다." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: m } = await supabase
    .from("organization_members").select("role").eq("user_id", user.id).limit(1).maybeSingle();
  if (m?.role !== "owner" && m?.role !== "admin") return { ok: false, error: "편집 권한이 없습니다." };

  const { error } = await supabase
    .from("brand_grade")
    .upsert({ brand: b, grade, updated_at: new Date().toISOString() }, { onConflict: "brand" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/bcd");
  return { ok: true };
}
