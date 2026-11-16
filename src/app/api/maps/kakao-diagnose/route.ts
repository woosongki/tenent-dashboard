/**
 * GET /api/maps/kakao-diagnose  (승인 사용자)
 *
 * 지도 로드가 실패했을 때 "왜"를 알려준다.
 * 카카오는 401 본문에 사유를 준다(`domain mismatched! caller=...` / `invalid appkey`).
 * 그런데 그 응답에는 Access-Control-Allow-Origin이 없어 브라우저에서 직접 읽을 수 없다
 * (2026-11 확인) → 서버에서 대신 호출해 사유만 돌려준다.
 *
 * Referer는 요청이 들어온 호스트에서 만든다(사용자 입력 사용 안 함). 대상 URL도 고정.
 */
import type { NextRequest } from "next/server";
import { requireApproved } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  const limited = rateLimit(`kakao-diagnose:${g.user.id}`, { limit: 6, windowMs: 60_000 });
  if (limited) {
    return Response.json({ error: limited.message }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const apiKey = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "").trim();
  if (!apiKey) {
    return Response.json({ origin: null, status: null, message: "NEXT_PUBLIC_KAKAO_MAP_KEY 미설정" });
  }

  // 브라우저가 보는 주소 = 카카오가 검사하는 도메인. 헤더에서 조립(입력값 아님).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : req.nextUrl.origin;

  try {
    const res = await fetch(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(apiKey)}&autoload=false`, {
      headers: { Referer: `${origin}/` },
      cache: "no-store",
    });
    if (res.ok) {
      return Response.json({ origin, status: res.status, message: "카카오 응답 정상(200) — 도메인·키 문제 아님" });
    }
    const body = (await res.text().catch(() => "")).slice(0, 300);
    let message = body;
    try {
      const j = JSON.parse(body) as { message?: string };
      if (j.message) message = j.message;
    } catch { /* 본문이 JSON이 아니면 원문 그대로 */ }
    return Response.json({ origin, status: res.status, message });
  } catch (e) {
    return Response.json({ origin, status: null, message: e instanceof Error ? e.message : "카카오 호출 실패" });
  }
}
