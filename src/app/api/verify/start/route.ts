import { NextRequest } from "next/server";
import { runVerifyPipeline } from "@/lib/verify/pipeline";
import { getSessionContext } from "@/lib/auth/session";
import type { VerifyRequest } from "@/lib/verify/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // T5-1: 권한 게이트 — owner/admin만 검증 가능
  const { user, role } = await getSessionContext();
  if (!user) {
    return new Response(JSON.stringify({ error: "인증이 필요합니다" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (role !== "owner" && role !== "admin") {
    return new Response(
      JSON.stringify({
        error: "검증은 owner/admin 권한자만 실행할 수 있습니다 (API 비용 보호). member는 결과 조회만 가능합니다.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = (await req.json()) as VerifyRequest;
  if (!body.company?.trim()) {
    return new Response(JSON.stringify({ error: "회사명을 입력하세요" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      try {
        for await (const event of runVerifyPipeline(body)) {
          send(event);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "파이프라인 오류";
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
