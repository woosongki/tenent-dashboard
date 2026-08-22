/**
 * POST /api/bcd/collect/kakao  (owner/admin, 온디맨드)
 *
 * 카카오맵 Local REST API로 브랜드 매장을 수집해 C1·C2·C3·C6를 자동 채운다 (PRD P3).
 * 외부 유료 호출이므로 requireRole + rateLimit로 보호. 키: KAKAO_REST_API_KEY.
 *
 * body(선택): { brandIds?: string[], limit?: number }  — 미지정 시 활성 브랜드 최대 30건.
 *
 * ⚠ 이 원격 에이전트 환경은 외부 API 프록시 403 → 여기서 실행 불가. 배포본/로컬에서 호출.
 */
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { runKakaoCollection } from "@/lib/bcd/collect/kakao";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const g = await requireRole("owner", "admin");
  if (!g.ok) return g.response;

  const restKey = process.env.KAKAO_REST_API_KEY;
  if (!restKey) {
    return Response.json(
      { error: "KAKAO_REST_API_KEY 환경변수가 없습니다. 카카오 개발자콘솔의 REST API 키(지도 JavaScript 키와 다름)를 설정하세요." },
      { status: 500 }
    );
  }

  const limited = rateLimit(`bcd-collect-kakao:${g.user.id}`, { limit: 4, windowMs: 60_000 });
  if (limited) {
    return Response.json({ error: limited.message }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const body = (await req.json().catch(() => ({}))) as { brandIds?: string[]; limit?: number };

  try {
    const summary = await runKakaoCollection({
      restKey,
      triggeredBy: `manual:${g.user.email ?? g.user.id}`,
      brandIds: body.brandIds,
      limit: typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 100) : undefined,
    });
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "수집 실패" }, { status: 500 });
  }
}
