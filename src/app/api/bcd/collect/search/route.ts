/**
 * POST /api/bcd/collect/search  (owner/admin, 온디맨드)
 *
 * 네이버 검색광고 keywordstool로 절대 검색수를 수집해 C4·C5를 채운다 (PRD P4).
 * 외부 유료 호출이므로 requireRole + rateLimit로 보호.
 * 키: NAVER_AD_API_KEY · NAVER_AD_SECRET_KEY · NAVER_AD_CUSTOMER_ID.
 *
 * body(선택): { brandIds?: string[], limit?: number }  — 미지정 시 활성 브랜드 최대 30건.
 *
 * ⚠ 원격 에이전트 환경은 외부 API 프록시 403 → 여기서 실행 불가. 배포본/로컬에서 호출.
 */
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { runNaverCollection } from "@/lib/bcd/collect/naver";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const g = await requireRole("owner", "admin");
  if (!g.ok) return g.response;

  const apiKey = process.env.NAVER_AD_API_KEY;
  const secretKey = process.env.NAVER_AD_SECRET_KEY;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  if (!apiKey || !secretKey || !customerId) {
    return Response.json(
      { error: "NAVER_AD_API_KEY · NAVER_AD_SECRET_KEY · NAVER_AD_CUSTOMER_ID 환경변수가 필요합니다. 네이버 검색광고(고급 API) 라이선스 키이며, 오픈API(데이터랩) 키와 다릅니다." },
      { status: 500 }
    );
  }

  const limited = rateLimit(`bcd-collect-naver:${g.user.id}`, { limit: 4, windowMs: 60_000 });
  if (limited) {
    return Response.json({ error: limited.message }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const body = (await req.json().catch(() => ({}))) as { brandIds?: string[]; limit?: number };

  try {
    const summary = await runNaverCollection({
      creds: { apiKey, secretKey, customerId },
      triggeredBy: `manual:${g.user.email ?? g.user.id}`,
      brandIds: body.brandIds,
      limit: typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 100) : undefined,
    });
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "수집 실패" }, { status: 500 });
  }
}
