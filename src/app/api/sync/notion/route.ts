import { NextResponse } from "next/server";
import { syncAll } from "@/lib/notion/sync";
import { createClient } from "@/lib/supabase/server";

/**
 * Notion → Supabase 동기화 라우트.
 *
 * 인증 방식 (둘 중 하나):
 * 1. Vercel Cron — Authorization: Bearer ${CRON_SECRET}
 * 2. 로그인된 사용자가 수동 트리거 — Supabase 세션 쿠키
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5분 (Vercel hobby 제한 고려)

async function isAuthorized(req: Request): Promise<boolean> {
  // Cron 인증
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;

  // 사용자 인증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NOTION_API_KEY) {
    return NextResponse.json({
      error: "NOTION_API_KEY not configured",
      hint: "Vercel 환경변수에 NOTION_API_KEY를 설정하고 노션 통합을 3개 DB에 share 하세요.",
    }, { status: 503 });
  }

  try {
    const start = Date.now();
    const results = await syncAll();
    const duration = Date.now() - start;
    return NextResponse.json({
      ok: true,
      duration_ms: duration,
      results,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) { return GET(req); }
