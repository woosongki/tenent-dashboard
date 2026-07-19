import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth/guards";
import { extractSession, sanitizeExtracted, type ExtractedSession } from "@/lib/meetings/extract";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * PATCH /api/meetings/:id/sessions/:sid
 * body: { rawText?, heldAt?, title?, extracted? }
 * - rawText 변경 시 extracted 재계산.
 * - extracted 만 오면(원문 미변경) 수동 편집분을 정제해 저장(항목 추가/수정/삭제).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; sid: string }> }
) {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  const { sid } = await ctx.params;
  if (!sid) return Response.json({ error: "session id 필요" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    rawText?: string;
    heldAt?: string;
    title?: string;
    extracted?: Partial<ExtractedSession>;
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.rawText === "string") {
    const rawText = body.rawText.trim();
    if (!rawText) return Response.json({ error: "rawText 는 비울 수 없습니다." }, { status: 400 });
    if (rawText.length > 50_000) return Response.json({ error: "원문이 너무 깁니다" }, { status: 413 });
    patch.raw_text = rawText;
    patch.extracted = extractSession(rawText);
  } else if (body.extracted && typeof body.extracted === "object") {
    // 원문은 그대로 두고, 수동 편집한 추출 항목만 정제 저장.
    patch.extracted = sanitizeExtracted(body.extracted);
  }
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 120) || null;
  if (typeof body.heldAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.heldAt)) {
    patch.held_at = body.heldAt;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "변경 내용 없음" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_meeting_sessions")
    .update(patch)
    .eq("id", sid)
    .select("id,meeting_id,session_index,title,held_at,raw_text,extracted,created_by,created_at,updated_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ session: data });
}

/**
 * DELETE /api/meetings/:id/sessions/:sid
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; sid: string }> }
) {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  const { sid } = await ctx.params;
  if (!sid) return Response.json({ error: "session id 필요" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("vendor_meeting_sessions")
    .delete()
    .eq("id", sid);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
