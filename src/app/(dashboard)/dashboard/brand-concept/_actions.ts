"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// 브랜드컨셉등급제(BCD) 콘솔 서버 액션.
// 인증은 쿠키(createClient)로, 권한조회·쓰기는 service_role(RLS 우회)로 — 기존 bcd/_actions 패턴과 동일.
// owner/admin만 쓰기 허용(AGENTS.md 보안 규약).

type Result = { ok: true } | { ok: false; error: string };

const NA_REASONS = new Set(["시계열부족", "검색어미확정", "매장미검출", "현장미확인", "표본부족"]);
const CODES = new Set(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
const SCOPES = new Set(["active", "excluded", "knockout"]);

/** 인증 + owner/admin 확인. 통과 시 service 클라이언트와 사용자 이메일 반환. */
async function guard(): Promise<
  | { ok: true; svc: ReturnType<typeof createServiceClient>; email: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const svc = createServiceClient();
  const { data: m, error } = await svc
    .from("organization_members").select("role").eq("user_id", user.id).limit(1).maybeSingle();
  if (error) return { ok: false, error: `권한 조회 실패: ${error.message}` };
  if (m?.role !== "owner" && m?.role !== "admin") return { ok: false, error: "편집 권한이 없습니다(관리자 전용)." };

  return { ok: true, svc, email: user.email ?? null };
}

/** 브랜드 등록. category_major/minor는 자유 입력(택소노미 확정 전). */
export async function registerBrand(input: {
  name: string;
  category_major: string;
  category_minor: string;
  online_applicable: boolean;
}): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;

  const name = input.name?.trim();
  const major = input.category_major?.trim();
  const minor = input.category_minor?.trim();
  if (!name) return { ok: false, error: "브랜드명이 필요합니다." };
  if (!major || !minor) return { ok: false, error: "대분류·중분류가 필요합니다." };

  const { error } = await g.svc.from("bcd_brands").insert({
    name: name.slice(0, 200),
    category_major: major.slice(0, 100),
    category_minor: minor.slice(0, 100),
    online_applicable: !!input.online_applicable,
    scope_status: "active",
  });
  if (error) return { ok: false, error: `등록 실패: ${error.message}` };

  revalidatePath("/dashboard/brand-concept");
  return { ok: true };
}

/** 지표 원값 1건 기록(수동). value=null이면 na_reason 필수(0으로 채우지 않음). */
export async function saveMetric(input: {
  brand_id: string;
  metric_code: string;
  value: number | null;
  na_reason?: string;
}): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;

  if (!input.brand_id) return { ok: false, error: "brand_id가 필요합니다." };
  if (!CODES.has(input.metric_code)) return { ok: false, error: "metric_code는 C1~C8이어야 합니다." };
  const hasValue = input.value !== null && input.value !== undefined && !Number.isNaN(input.value);
  if (!hasValue && !input.na_reason) {
    return { ok: false, error: "값이 없으면 N/A 사유가 필수입니다(0으로 채우지 마십시오)." };
  }
  if (input.na_reason && !NA_REASONS.has(input.na_reason)) {
    return { ok: false, error: `N/A 사유는 다음 중 하나: ${[...NA_REASONS].join(" · ")}` };
  }

  const { error } = await g.svc.from("bcd_metric_values").insert({
    brand_id: input.brand_id,
    metric_code: input.metric_code,
    value: hasValue ? input.value : null,
    na_reason: hasValue ? null : input.na_reason,
    source: "manual",
    checked_by: g.email,
  });
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  revalidatePath("/dashboard/brand-concept");
  return { ok: true };
}

/** 브랜드 범위 상태 변경 (active · excluded=X 제외 · knockout=H 거래불가). */
export async function setBrandScope(brand_id: string, scope_status: string, exclude_reason?: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  if (!brand_id) return { ok: false, error: "brand_id가 필요합니다." };
  if (!SCOPES.has(scope_status)) return { ok: false, error: "scope_status 값이 올바르지 않습니다." };

  const { error } = await g.svc
    .from("bcd_brands")
    .update({
      scope_status,
      exclude_reason: scope_status === "excluded" ? (exclude_reason?.trim().slice(0, 200) || null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brand_id);
  if (error) return { ok: false, error: `변경 실패: ${error.message}` };

  revalidatePath("/dashboard/brand-concept");
  return { ok: true };
}
