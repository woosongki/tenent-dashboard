import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { getRecentMeetings } from "@/lib/meetings/recent";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { user } = await getSessionContext();
  if (!user) return Response.json({ error: "인증이 필요합니다." }, { status: 401 });

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const orgId: string | null = (membership?.organization_id as string | undefined) ?? null;
  if (!orgId) return Response.json({ items: [] });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30"), 100);
  const items = await getRecentMeetings(orgId, limit);
  return Response.json({ items });
}
