import { NextRequest } from "next/server";
import { searchCorpCandidates } from "@/lib/verify/dart";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return new Response(JSON.stringify({ candidates: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const candidates = searchCorpCandidates(q, 30);
  return new Response(JSON.stringify({ candidates }), {
    headers: { "Content-Type": "application/json" },
  });
}
