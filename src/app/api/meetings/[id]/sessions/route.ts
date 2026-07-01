import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { extractSession } from "@/lib/meetings/extract";

export const runtime = "nodejs";
export const maxDuration = 15;

interface SessionRow {
  id: string;
  meeting_id: string;
  session_index: number;
  title: string | null;
  held_at: string;
  raw_text: string;
  extracted: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * POST /api/meetings/:id/sessions
 * body: { rawText: string, heldAt?: 'YYYY-MM-DD', title?: string }
 * → 다음 session_index 자동 부여, 원문 즉시 서버측에서 재파싱.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { user } = await getSessionContext();
  if (!user) return Response.json({ error: "인증이 필요합니다." }, { status: 401 });

  const limited = rateLimit(`meetings-session:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "meeting id 필요" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    rawText?: string;
    heldAt?: string;
    title?: string;
  };

  const rawText = body.rawText?.trim();
  if (!rawText) return Response.json({ error: "rawText 필수" }, { status: 400 });
  if (rawText.length > 50_000) {
    return Response.json({ error: "원문이 너무 깁니다 (50,000자 초과)" }, { status: 413 });
  }

  const heldAt = body.heldAt && /^\d{4}-\d{2}-\d{2}$/.test(body.heldAt)
    ? body.heldAt
    : new Date().toISOString().slice(0, 10);
  const title = body.title?.trim().slice(0, 120) || null;

  const supabase = await createClient();

  // 부모 vendor_meetings 조회 (organization_id 확보, RLS로 권한 검증)
  const { data: parent, error: pErr } = await supabase
    .from("vendor_meetings")
    .select("id,organization_id,stage")
    .eq("id", id)
    .maybeSingle();

  if (pErr) return Response.json({ error: pErr.message }, { status: 500 });
  if (!parent) return Response.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });

  // 다음 session_index — 현재 최대값 + 1 (unique 제약 있어서 동시 삽입 시 하나만 성공, 재시도는 클라이언트에서)
  const { data: last } = await supabase
    .from("vendor_meeting_sessions")
    .select("session_index")
    .eq("meeting_id", id)
    .order("session_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextIndex = ((last?.session_index as number | undefined) ?? 0) + 1;

  const extracted = extractSession(rawText);

  const { data: inserted, error: insErr } = await supabase
    .from("vendor_meeting_sessions")
    .insert({
      meeting_id: id,
      organization_id: parent.organization_id,
      session_index: nextIndex,
      title,
      held_at: heldAt,
      raw_text: rawText,
      extracted,
      created_by: user.id,
    })
    .select("id,meeting_id,session_index,title,held_at,raw_text,extracted,created_by,created_at,updated_at")
    .single();

  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

  // stage 를 meeting 으로 승격 (아직 brief 라면) — done 은 건드리지 않음
  if (parent.stage === "brief") {
    await supabase.from("vendor_meetings").update({ stage: "meeting" }).eq("id", id);
  }

  return Response.json({ session: inserted as SessionRow });
}

/**
 * GET /api/meetings/:id/sessions
 * → 해당 업체의 모든 세션 (session_index desc).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { user } = await getSessionContext();
  if (!user) return Response.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "meeting id 필요" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_meeting_sessions")
    .select("id,meeting_id,session_index,title,held_at,raw_text,extracted,created_by,created_at,updated_at")
    .eq("meeting_id", id)
    .order("session_index", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sessions: (data ?? []) as SessionRow[] });
}
