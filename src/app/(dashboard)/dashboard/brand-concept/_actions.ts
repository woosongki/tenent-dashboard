"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateRuleset, type Ruleset } from "@/lib/bcd/score";

// 브랜드컨셉등급제(BCD) 콘솔 서버 액션.
// 인증은 쿠키(createClient)로, 권한조회·쓰기는 service_role(RLS 우회)로 — 기존 bcd/_actions 패턴과 동일.
// owner/admin만 쓰기 허용(AGENTS.md 보안 규약).

type Result = { ok: true } | { ok: false; error: string };

const NA_REASONS = new Set(["시계열부족", "검색어미확정", "매장미검출", "현장미확인", "표본부족"]);
const CODES = new Set(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
const SCOPES = new Set(["active", "excluded", "knockout"]);
const LIST_TYPES = new Set(["benchmark", "hotspot", "channel"]);

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

/** 벤치마크 유통 수(전수조사) 변경 시 전 브랜드 C1 재계산.
 *  각 benchmark_manual C1 행의 detail.malls 개수를 새 분모로 나눠 value 갱신. */
async function recomputeBenchmarkC1(svc: ReturnType<typeof createServiceClient>): Promise<void> {
  const { data: bm } = await svc.from("bcd_lists").select("id").eq("list_type", "benchmark").eq("is_full_survey", true);
  const denom = bm?.length ?? 0;
  if (denom < 1) return; // 전수조사 유통이 없으면 재계산 스킵(0 나눗셈 방지)

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await svc
      .from("bcd_metric_values")
      .select("id, value, detail")
      .eq("metric_code", "C1").eq("source", "benchmark_manual")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`C1 재계산 조회 실패: ${error.message}`);
    const rows = (data ?? []) as { id: string; value: number | null; detail: { malls?: string[] } | null }[];
    for (const r of rows) {
      const n = Array.isArray(r.detail?.malls) ? r.detail!.malls!.length : 0;
      const nv = Math.round((n / denom) * 100);
      if (nv !== r.value) await svc.from("bcd_metric_values").update({ value: nv }).eq("id", r.id);
    }
    if (rows.length < PAGE) break;
  }
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

/** 브랜드 삭제. 하위 지표·flag·검색량은 FK on delete cascade로 함께 삭제. */
export async function deleteBrand(brandId: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  if (!brandId) return { ok: false, error: "brand_id가 필요합니다." };
  const { error } = await g.svc.from("bcd_brands").delete().eq("id", brandId);
  if (error) return { ok: false, error: `삭제 실패: ${error.message}` };
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

/** C1 입점 매트릭스 저장 — 입점한 벤치마크 유통 목록 → C1% 자동계산해 기록.
 *  value = 입점 유통 수 ÷ 전수조사(is_full_survey) 유통 수 × 100. source=benchmark_manual, detail.malls 보존. */
export async function setC1Presence(brandId: string, malls: string[]): Promise<{ ok: true; value: number } | { ok: false; error: string }> {
  const g = await guard();
  if (!g.ok) return g;
  if (!brandId) return { ok: false, error: "brand_id가 필요합니다." };

  const { data: bm, error: bmErr } = await g.svc
    .from("bcd_lists").select("id").eq("list_type", "benchmark").eq("is_full_survey", true);
  if (bmErr) return { ok: false, error: `벤치마크 조회 실패: ${bmErr.message}` };
  const denom = (bm?.length ?? 0) || 10;

  const clean = [...new Set((malls ?? []).map((m) => m.trim()).filter(Boolean))].slice(0, 50);
  const value = Math.round((clean.length / denom) * 100);

  const { error } = await g.svc.from("bcd_metric_values").insert({
    brand_id: brandId, metric_code: "C1", value,
    source: "benchmark_manual", checked_by: g.email,
    detail: { malls: clean, denom },
  });
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  revalidatePath("/dashboard/brand-concept");
  return { ok: true, value };
}

/** 기준(ruleset) 저장 — 새 버전으로 활성화(기존은 비활성). 기본배점 합 100 검증 필수(PRD 10.1절). */
export async function saveRuleset(definition: Ruleset, note?: string): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  const g = await guard();
  if (!g.ok) return g;

  const v = validateRuleset(definition);
  if (!v.ok) return { ok: false, error: v.message };

  // 다음 버전 계산 (vMAJOR.MINOR 중 최대에서 minor +1, 없으면 v1.1)
  const { data: rows } = await g.svc.from("bcd_rulesets").select("version");
  let maxMajor = 1, maxMinor = 0;
  for (const r of (rows ?? []) as { version: string }[]) {
    const m = /^v(\d+)\.(\d+)$/.exec(r.version ?? "");
    if (!m) continue;
    const major = Number(m[1]), minor = Number(m[2]);
    if (major > maxMajor || (major === maxMajor && minor > maxMinor)) { maxMajor = major; maxMinor = minor; }
  }
  const nextVersion = `v${maxMajor}.${maxMinor + 1}`;

  // 활성 ruleset은 항상 1개(부분 유니크 인덱스) — 먼저 전부 비활성화 후 새 버전 활성 삽입.
  const { error: deErr } = await g.svc.from("bcd_rulesets").update({ is_active: false }).eq("is_active", true);
  if (deErr) return { ok: false, error: `기존 비활성화 실패: ${deErr.message}` };

  const { error: insErr } = await g.svc.from("bcd_rulesets").insert({
    version: nextVersion,
    definition,
    is_active: true,
    created_by: g.email,
    note: note?.slice(0, 500) || null,
  });
  if (insErr) return { ok: false, error: `저장 실패: ${insErr.message}` };

  revalidatePath("/dashboard/brand-concept");
  return { ok: true, version: nextVersion };
}

/** 목록(bcd_lists) 행 추가 — 벤치마크 유통 / 핫플 상권 확장용. match_strings는 CSV로 받아 배열화. */
export async function addList(input: {
  list_type: string;
  name: string;
  match_strings: string;   // 쉼표 구분
  is_full_survey?: boolean;
}): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  if (!LIST_TYPES.has(input.list_type)) return { ok: false, error: "list_type은 benchmark·hotspot·channel 중 하나여야 합니다." };
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "이름이 필요합니다." };
  const match = (input.match_strings ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);

  const { error } = await g.svc.from("bcd_lists").insert({
    list_type: input.list_type,
    version: "v1.0",
    name: name.slice(0, 200),
    match_strings: match,
    is_full_survey: input.list_type === "benchmark" ? !!input.is_full_survey : false,
  });
  if (error) return { ok: false, error: `추가 실패: ${error.message}` };

  // 벤치마크(전수조사) 추가 시 분모 변동 → 전 브랜드 C1 재계산.
  if (input.list_type === "benchmark") await recomputeBenchmarkC1(g.svc);

  revalidatePath("/dashboard/brand-concept");
  return { ok: true };
}

/** 목록(bcd_lists) 행 삭제. */
export async function deleteList(id: string): Promise<Result> {
  const g = await guard();
  if (!g.ok) return g;
  if (!id) return { ok: false, error: "id가 필요합니다." };
  // 삭제 대상이 벤치마크면 분모 변동 → 재계산 필요.
  const { data: row } = await g.svc.from("bcd_lists").select("list_type").eq("id", id).maybeSingle();
  const { error } = await g.svc.from("bcd_lists").delete().eq("id", id);
  if (error) return { ok: false, error: `삭제 실패: ${error.message}` };
  if (row?.list_type === "benchmark") await recomputeBenchmarkC1(g.svc);
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
