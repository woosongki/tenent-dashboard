import { NextRequest } from "next/server";
import { searchCorpCandidates, enrichCandidates } from "@/lib/verify/dart";
import { getSessionContext } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // 인증 게이트 — 미인증 호출이 DART API를 호출해 비용/rate limit 유발하던 구멍 차단
  const { user, role } = await getSessionContext();
  if (!user) {
    return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (role !== "owner" && role !== "admin") {
    return Response.json({ error: "owner/admin만 사용할 수 있습니다." }, { status: 403 });
  }

  // 레이트 리밋 — DART 회사 조회(enrich) 비용 보호, 분당 30회
  const limited = rateLimit(`search-corps:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (limited) {
    return Response.json({ error: limited.message }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return new Response(JSON.stringify({ candidates: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  // 너무 많으면 DART API 호출이 늘어나므로 후보를 20개로 제한
  const candidates = searchCorpCandidates(q, 20);
  // DART에서 대표자명·설립일·업종코드 병렬 조회
  const enriched = await enrichCandidates(candidates);
  return new Response(JSON.stringify({ candidates: enriched }), {
    headers: { "Content-Type": "application/json" },
  });
}
