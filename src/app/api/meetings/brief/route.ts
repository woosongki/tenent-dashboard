import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { runMeetingBrief, summarizeBrief } from "@/lib/meetings/brief";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_HOURS = 24;

interface BriefRow {
  id: string;
  brand: string;
  company: string | null;
  corp_code: string | null;
  stage: string;
  brief_payload: unknown;
  brief_summary: string | null;
  meeting_payload: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

async function getOrgId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

/**
 * POST /api/meetings/brief
 * body: { brand: string, corpCode?: string, force?: boolean }
 * 24시간 내 동일 브랜드 row가 있으면 재사용. force=true 면 새로 fetch.
 */
export async function POST(req: NextRequest) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const { user } = g;

  const limited = rateLimit(`meetings-brief:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    brand?: string;
    corpCode?: string;
    force?: boolean;
  };
  const brand = body.brand?.trim();
  if (!brand) return Response.json({ error: "brand 입력 필수" }, { status: 400 });

  const orgId = await getOrgId(user.id);
  if (!orgId) return Response.json({ error: "조직 멤버십이 필요합니다." }, { status: 403 });

  const supabase = await createClient();

  // ── 캐시 조회 (24시간 이내 동일 브랜드 row) ──────────────
  if (!body.force) {
    const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from("vendor_meetings")
      .select("id,brand,company,corp_code,stage,brief_payload,brief_summary,meeting_payload,created_by,created_at,updated_at")
      .eq("organization_id", orgId)
      .eq("brand", brand)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) {
      return Response.json({ row: cached as BriefRow, cached: true });
    }
  }

  // ── 신규 fetch ────────────────────────────────────────
  const payload = await runMeetingBrief({ brand, corpCode: body.corpCode ?? null });
  const summary = summarizeBrief(payload);

  const { data: inserted, error } = await supabase
    .from("vendor_meetings")
    .insert({
      organization_id: orgId,
      brand,
      company: payload.company,
      corp_code: payload.corpCode,
      stage: "brief",
      brief_payload: payload,
      brief_summary: summary,
      created_by: user.id,
    })
    .select("id,brand,company,corp_code,stage,brief_payload,brief_summary,meeting_payload,created_by,created_at,updated_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ row: inserted as BriefRow, cached: false });
}

/**
 * GET /api/meetings/brief?brand=X&limit=20
 * 최근 브리프 row 리스트. brand 지정시 해당 브랜드만.
 */
export async function GET(req: NextRequest) {
  const g = await requireApproved();
  if (!g.ok) return g.response;
  const { user } = g;

  const orgId = await getOrgId(user.id);
  if (!orgId) return Response.json({ error: "조직 멤버십이 필요합니다." }, { status: 403 });

  const brand = req.nextUrl.searchParams.get("brand")?.trim() ?? "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);

  const supabase = await createClient();
  let query = supabase
    .from("vendor_meetings")
    .select("id,brand,company,corp_code,stage,brief_payload,brief_summary,meeting_payload,created_by,created_at,updated_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (brand) query = query.eq("brand", brand);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ rows: (data ?? []) as BriefRow[] });
}
