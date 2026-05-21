import "server-only";
import { getNotionClient } from "@/lib/notion/client";

const TENANT_DB_ID = process.env.NOTION_DB_VERIFY_TENANT_ID ?? "";
const CACHE_DAYS = 30; // T2-3: 30일 내 동일 회사 검증 결과는 캐시

export interface CachedVerification {
  hit: true;
  notionPageId: string;
  notionUrl: string;
  daysSince: number;
  verifiedAt: string;
  grade: string | null;
  summary: string | null;
}

export interface NoCacheHit {
  hit: false;
}

/**
 * Notion에서 동일 회사명 + 30일 내 검증 이력 조회
 * 캐시 적중 시 Claude 호출 자체를 스킵 (비용 100% 절감)
 */
export async function findRecentVerification(companyName: string): Promise<CachedVerification | NoCacheHit> {
  const notion = getNotionClient();
  if (!notion || !TENANT_DB_ID) return { hit: false };

  try {
    // v5 API: databases.retrieve로 data_source_id 획득
    const db = (await notion.databases.retrieve({ database_id: TENANT_DB_ID })) as {
      data_sources?: Array<{ id: string }>;
    };
    const dsId = db.data_sources?.[0]?.id;
    if (!dsId) return { hit: false };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CACHE_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const result = await notion.dataSources.query({
      data_source_id: dsId,
      filter: {
        and: [
          { property: "회사명", title: { equals: companyName } },
          { property: "검증일", date: { on_or_after: cutoffStr } },
        ],
      },
      sorts: [{ property: "검증일", direction: "descending" }],
      page_size: 1,
    });

    const page = result.results[0] as
      | { id: string; properties: Record<string, unknown> }
      | undefined;
    if (!page) return { hit: false };

    const props = page.properties;
    const dateProp = props["검증일"] as { date?: { start: string } } | undefined;
    const gradeProp = props["재무 등급"] as { select?: { name: string } } | undefined;
    const noteProp = props["비고"] as { rich_text?: Array<{ plain_text: string }> } | undefined;

    const verifiedAt = dateProp?.date?.start;
    if (!verifiedAt) return { hit: false };
    const daysSince = Math.floor((Date.now() - new Date(verifiedAt).getTime()) / 86400000);

    return {
      hit: true,
      notionPageId: page.id,
      notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
      daysSince,
      verifiedAt,
      grade: gradeProp?.select?.name ?? null,
      summary: noteProp?.rich_text?.map((t) => t.plain_text).join("") ?? null,
    };
  } catch {
    return { hit: false };
  }
}
