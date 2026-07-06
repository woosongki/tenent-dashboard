import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * POST /api/meetings/reorder   body: { ids: string[] }
 * 랜딩 업체 카드 순서를 서버에 저장(팀 공유). ids[i] 의 sort_order = i.
 * 조직 스코프로만 갱신(다른 조직 행 미변경).
 */
export async function POST(req: NextRequest) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const { user } = g;

  const limited = rateLimit(`meetings-reorder:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500)
    : null;
  if (!ids || ids.length === 0) return Response.json({ error: "ids 필요" }, { status: 400 });

  const supabase = await createClient();
  const { data: mm } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const orgId = (mm?.organization_id as string | undefined) ?? null;
  if (!orgId) return Response.json({ error: "조직 정보를 찾을 수 없습니다." }, { status: 400 });

  // 조직 스코프로만 sort_order 갱신 (id별 인덱스).
  const results = await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("vendor_meetings")
        .update({ sort_order: i })
        .eq("id", id)
        .eq("organization_id", orgId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return Response.json({ error: failed.error.message }, { status: 500 });

  return Response.json({ ok: true });
}
