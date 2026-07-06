/**
 * GET /api/sync/notion/schema?ds=<DATA_SOURCE_ID>
 * 지정 data source의 프로퍼티 스키마 + 첫 행 샘플 반환.
 * 노션 프로퍼티 이름 확인용.
 */
import { NextResponse } from "next/server";
import { getNotionClient, NOTION_DATA_SOURCE_IDS } from "@/lib/notion/client";
import { requireApproved } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  const notion = getNotionClient();
  if (!notion) return NextResponse.json({ error: "NOTION_API_KEY not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const ds = searchParams.get("ds") ?? NOTION_DATA_SOURCE_IDS.vendorLease;
  if (!ds) return NextResponse.json({ error: "?ds=<id> 또는 NOTION_DS_VENDOR_LEASE 필요" }, { status: 400 });

  try {
    // 첫 행 1개만 조회
    const resp = await notion.dataSources.query({
      data_source_id: ds,
      page_size: 1,
    });

    const sample = resp.results[0] as Record<string, unknown> | undefined;
    if (!sample) return NextResponse.json({ ds, count: 0, properties: {}, sample: null });

    const props = (sample.properties as Record<string, { type: string; [k: string]: unknown }>) ?? {};

    // 프로퍼티 이름 + 타입 + 실제 값 요약
    const schema: Record<string, { type: string; value: unknown }> = {};
    for (const [name, def] of Object.entries(props)) {
      const t = def.type;
      let value: unknown = null;
      const d = def as Record<string, unknown>;
      if (t === "title")        value = (d.title as Array<{ plain_text: string }>)?.map((x) => x.plain_text).join("");
      else if (t === "rich_text")    value = (d.rich_text as Array<{ plain_text: string }>)?.map((x) => x.plain_text).join("");
      else if (t === "select")       value = (d.select as { name: string } | null)?.name ?? null;
      else if (t === "status")       value = (d.status as { name: string } | null)?.name ?? null;
      else if (t === "multi_select") value = (d.multi_select as Array<{ name: string }>)?.map((x) => x.name);
      else if (t === "checkbox")     value = d.checkbox;
      else if (t === "number")       value = d.number;
      else if (t === "url")          value = d.url;
      else if (t === "phone_number") value = d.phone_number;
      else if (t === "date")         value = (d.date as { start: string } | null)?.start ?? null;
      else                           value = `(${t})`;
      schema[name] = { type: t, value };
    }

    return NextResponse.json({ ds, properties: schema });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
