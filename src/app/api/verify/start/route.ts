import { NextRequest } from "next/server";
import { runVerifyPipeline } from "@/lib/verify/pipeline";
import type { VerifyRequest } from "@/lib/verify/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
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
