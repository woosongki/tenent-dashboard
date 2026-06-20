"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rankStores } from "@/lib/brand-fit/score";
import type { BrandInput, FitScore } from "@/lib/brand-fit/types";

/**
 * 브랜드 적합도 분석 — 서버에서 계산.
 * 무거운 매장 데이터(store-brands.json 등)를 클라이언트 번들에서 제외하기 위해
 * 점수 산출을 서버 액션으로 수행하고 상위 결과만 반환한다.
 */
export async function analyzeBrandFit(input: BrandInput, topN = 3): Promise<FitScore[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return rankStores(input, topN);
}
