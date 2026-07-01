import type { NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { extractOfficeText } from "@/lib/meetings/officeText";

export const runtime = "nodejs";
export const maxDuration = 30;

const SUPPORTED = new Set(["pdf", "docx", "pptx"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * POST /api/meetings/extract-file  (multipart form-data: file)
 * PPTX·DOCX·PDF → 순수 텍스트 추출(LLM 아님·비용 0). 세션 원문 채우기용.
 */
export async function POST(req: NextRequest) {
  const { user } = await getSessionContext();
  if (!user) return Response.json({ error: "인증이 필요합니다." }, { status: 401 });

  const limited = rateLimit(`meetings-extract:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "파일이 없습니다." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "파일이 너무 큽니다(20MB 초과)." }, { status: 413 });

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!SUPPORTED.has(ext)) {
    return Response.json(
      { error: `.${ext}는 자동 추출을 지원하지 않습니다. .pptx/.docx/.pdf 또는 .txt로 저장해 주세요.` },
      { status: 415 },
    );
  }

  try {
    const text = await extractOfficeText(await file.arrayBuffer(), ext);
    if (!text.trim()) {
      return Response.json(
        { error: "텍스트를 찾지 못했습니다(이미지 스캔본이거나 도형 안 텍스트일 수 있음)." },
        { status: 422 },
      );
    }
    return Response.json({ text, note: `${file.name} · ${text.length.toLocaleString()}자` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "추출 실패";
    return Response.json({ error: `추출 실패: ${msg}` }, { status: 500 });
  }
}
