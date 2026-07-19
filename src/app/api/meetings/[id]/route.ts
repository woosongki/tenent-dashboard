import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { buildSeedQuestions } from "@/lib/meetings/seeds";
import type { MeetingBriefPayload } from "@/lib/meetings/brief";

export const runtime = "nodejs";
export const maxDuration = 15;

interface QA {
  id: string;
  category?: string;
  q: string;
  a: string;
}

interface MeetingPayload {
  questions: QA[];
  memo: string;
  completedAt: string | null;
}

const ALLOWED_STAGES = ["brief", "meeting", "proposal", "done"] as const;
type Stage = (typeof ALLOWED_STAGES)[number];

/**
 * PATCH /api/meetings/:id
 * body: { stage?: Stage, meeting_payload?: MeetingPayload, autoSeed?: boolean }
 *
 * - autoSeed=true & 기존 meeting_payload 없음 → 브리프 payload로 seed 질문 생성해 채움
 * - stage 전환, Q&A 저장 모두 같은 엔드포인트로
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/meetings/[id]">) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const { user } = g;

  const limited = rateLimit(`meetings-patch:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "id 필요" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    stage?: Stage;
    meeting_payload?: Partial<MeetingPayload>;
    autoSeed?: boolean;
    brand?: string;
    company?: string;
  };

  const supabase = await createClient();

  // 기존 row (org 권한은 RLS에 위임)
  const { data: existing, error: fetchErr } = await supabase
    .from("vendor_meetings")
    .select("id,organization_id,brand,stage,brief_payload,meeting_payload")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return Response.json({ error: "찾을 수 없음" }, { status: 404 });

  // ── 업데이트 patch 조립 ─────────────────────────────────────
  const patch: { stage?: Stage; meeting_payload?: MeetingPayload; brand?: string; company?: string | null } = {};

  // 브랜드/회사명 수정(rename)
  if (typeof body.brand === "string" && body.brand.trim()) patch.brand = body.brand.trim().slice(0, 200);
  if (typeof body.company === "string") patch.company = body.company.trim().slice(0, 200) || null;

  if (body.stage) {
    if (!ALLOWED_STAGES.includes(body.stage)) {
      return Response.json({ error: "잘못된 stage" }, { status: 400 });
    }
    patch.stage = body.stage;
  }

  // autoSeed 처리 — meeting_payload가 없거나 questions가 비었을 때만
  let nextPayload: MeetingPayload | undefined =
    (body.meeting_payload as MeetingPayload | undefined) ??
    (existing.meeting_payload as MeetingPayload | null) ??
    undefined;

  if (body.autoSeed) {
    const currentQ =
      nextPayload?.questions ??
      (existing.meeting_payload as MeetingPayload | null)?.questions ??
      [];
    if (currentQ.length === 0) {
      const brief = existing.brief_payload as MeetingBriefPayload | null;
      if (brief) {
        const seeds = buildSeedQuestions(brief);
        nextPayload = {
          questions: seeds.map((s) => ({ id: s.id, category: s.category, q: s.q, a: "" })),
          memo: nextPayload?.memo ?? "",
          completedAt: nextPayload?.completedAt ?? null,
        };
      }
    }
  }

  if (body.meeting_payload !== undefined) {
    nextPayload = {
      questions: body.meeting_payload.questions ?? nextPayload?.questions ?? [],
      memo: body.meeting_payload.memo ?? nextPayload?.memo ?? "",
      completedAt: body.meeting_payload.completedAt ?? nextPayload?.completedAt ?? null,
    };
  }

  if (nextPayload && (body.meeting_payload !== undefined || body.autoSeed)) {
    patch.meeting_payload = nextPayload;
  }

  // 완료 처리 — stage='done' 으로 갈 때 completedAt 자동 세팅
  if (patch.stage === "done" && patch.meeting_payload) {
    patch.meeting_payload.completedAt = patch.meeting_payload.completedAt ?? new Date().toISOString();
  } else if (patch.stage === "done" && nextPayload) {
    patch.meeting_payload = {
      ...nextPayload,
      completedAt: nextPayload.completedAt ?? new Date().toISOString(),
    };
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "변경 내용 없음" }, { status: 400 });
  }

  const { data: updated, error: updErr } = await supabase
    .from("vendor_meetings")
    .update(patch)
    .eq("id", id)
    .select("id,brand,company,corp_code,stage,brief_payload,brief_summary,meeting_payload,created_by,created_at,updated_at")
    .single();

  if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

  return Response.json({ row: updated });
}

/**
 * DELETE /api/meetings/:id — 업체(브랜드) 삭제. 하위 세션은 FK on delete cascade로 함께 삭제.
 * (RouteContext 미사용 — 로컬 typed-route 스테일 오탐 회피)
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "id 필요" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_meetings").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
