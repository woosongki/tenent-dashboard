/**
 * BCD 지표 원값 API — 수동 입력(콘솔)과 자동 수집(향후 카카오맵·검색량 크론) 공용 진입점.
 *
 * POST /api/bcd/metrics  — 지표 1건 기록 (owner/admin)
 * GET  /api/bcd/metrics?brand_id=xxx — 브랜드 지표 이력(시계열) 조회 (승인 사용자)
 *
 * 핵심 규칙(PRD 08.2절): value=null인데 na_reason이 없으면 거부 — "수집 실패를 0으로 넣지 않는다".
 * 쓰기는 service_role 클라이언트(RLS 우회) + requireRole 게이트로 보호(AGENTS.md 보안 규약).
 */
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole, requireApproved } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 15;

const NA_REASONS = ["시계열부족", "검색어미확정", "매장미검출", "현장미확인", "표본부족"] as const;
const VALID_CODES = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];
const VALID_SOURCES = ["manual", "kakao_map", "naver_ads", "ftc_franchise"];

export async function POST(req: NextRequest) {
  const g = await requireRole("owner", "admin");
  if (!g.ok) return g.response;

  const limited = rateLimit(`bcd-metrics:${g.user.id}`, { limit: 60, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    metric_code?: string;
    value?: number | null;
    na_reason?: string;
    source?: string;
    detail?: unknown;
    checked_by?: string;
    snapshot_run_id?: string;
  };
  const { brand_id, metric_code, value, na_reason, source, detail, checked_by, snapshot_run_id } = body;

  if (!brand_id || !metric_code || !VALID_CODES.includes(metric_code)) {
    return Response.json({ error: "brand_id, metric_code(C1~C8)는 필수입니다." }, { status: 400 });
  }
  if (!source || !VALID_SOURCES.includes(source)) {
    return Response.json({ error: `source는 다음 중 하나여야 합니다: ${VALID_SOURCES.join(" · ")}` }, { status: 400 });
  }
  if ((value === null || value === undefined) && !na_reason) {
    return Response.json(
      { error: "value가 없으면 na_reason이 필수입니다. 0으로 채우지 마십시오 (PRD 08.2절)." },
      { status: 400 }
    );
  }
  if (na_reason && !NA_REASONS.includes(na_reason as (typeof NA_REASONS)[number])) {
    return Response.json(
      { error: `na_reason은 다음 중 하나여야 합니다: ${NA_REASONS.join(" · ")}` },
      { status: 400 }
    );
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("bcd_metric_values")
    .insert({
      brand_id,
      metric_code,
      value: value ?? null,
      na_reason: na_reason ?? null,
      source,
      detail: (detail as Record<string, unknown>) ?? null,
      checked_by: checked_by ?? g.user.email ?? null,
      snapshot_run_id: snapshot_run_id ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, row: data });
}

export async function GET(req: NextRequest) {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  const brandId = req.nextUrl.searchParams.get("brand_id");
  if (!brandId) return Response.json({ error: "brand_id 쿼리 파라미터가 필요합니다." }, { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("bcd_metric_values")
    .select("*")
    .eq("brand_id", brandId)
    .order("checked_on", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ rows: data });
}
