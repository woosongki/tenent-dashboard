/**
 * GET /api/sync/notion/databases
 * 인테그레이션이 접근 가능한 모든 데이터베이스 목록을 반환.
 * NOTION_DS_VENDOR_LEASE 에 넣을 올바른 ID 확인용.
 */
import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // 로그인 유저만 접근
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notion = getNotionClient();
  if (!notion) return NextResponse.json({ error: "NOTION_API_KEY not configured" }, { status: 503 });

  try {
    // search API로 전체 DB 목록 조회
    let cursor: string | undefined;
    const databases: { id: string; title: string }[] = [];

    do {
      const resp = await notion.search({
        filter: { value: "data_source", property: "object" },
        page_size: 100,
        start_cursor: cursor,
      });

      for (const item of resp.results) {
        const db = item as Record<string, unknown>;
        const titleArr = (db.title as Array<{ plain_text: string }> | undefined) ?? [];
        const title = titleArr.map((t) => t.plain_text).join("") || "(제목 없음)";
        databases.push({ id: db.id as string, title });
      }

      cursor = (resp as { next_cursor?: string | null }).next_cursor ?? undefined;
    } while (cursor);

    return NextResponse.json({ count: databases.length, databases });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
