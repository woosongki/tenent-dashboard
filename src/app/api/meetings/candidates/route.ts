import { NextRequest } from "next/server";
import { requireApproved } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { listCorpCandidates } from "@/lib/meetings/brief";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * GET /api/meetings/candidates?q=<brand>
 * DART에서 회사명 후보 검색 (typeahead 보조).
 * 모든 로그인 멤버 허용 (조회만).
 */
export async function GET(req: NextRequest) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const { user } = g;

  // DART enrichCandidates는 후보별 1 API 호출 → 분당 30회로 제한
  const limited = rateLimit(`meetings-candidates:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ candidates: [] });

  const candidates = await listCorpCandidates(q, 8);
  return Response.json({ candidates });
}
