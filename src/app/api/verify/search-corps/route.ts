import { NextRequest } from "next/server";
import { searchCorpCandidates, enrichCandidates } from "@/lib/verify/dart";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
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
