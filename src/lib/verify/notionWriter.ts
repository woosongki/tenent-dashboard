import "server-only";
import { getNotionClient } from "@/lib/notion/client";
import type { VerifyBrief, NewsArticle } from "./types";

const TENANT_DB_ID = process.env.NOTION_DB_VERIFY_TENANT_ID ?? "";
const NEWS_DB_ID = process.env.NOTION_DB_VERIFY_NEWS_ID ?? "";

function toB(n: number | null): number | null {
  return n === null ? null : Math.round(n / 1e8);
}

function todayPlusSixMonths(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export async function writeBriefToNotion(brief: VerifyBrief): Promise<{ pageId: string; url: string } | null> {
  const notion = getNotionClient();
  if (!notion || !TENANT_DB_ID) return null;

  const latestYear = brief.financials.years[0];

  const riskNames = brief.riskFlags.map((r) => r.flag).slice(0, 5);
  const focusSummary = brief.focusAreas
    .slice(0, 3)
    .map((f) => `[${f.category}] ${f.summary}`)
    .join(" | ");

  const questionsText = brief.questions
    .map((q, i) => `${i + 1}. [${q.category}] ${q.question}`)
    .join("\n");

  const page = await notion.pages.create({
    parent: { database_id: TENANT_DB_ID },
    properties: {
      "회사명": { title: [{ text: { content: brief.companyName } }] },
      "약칭/브랜드": { rich_text: [{ text: { content: brief.brandName ?? "" } }] },
      "사업자번호": { rich_text: [{ text: { content: brief.bizrNo ?? "" } }] },
      "DART 고유번호": { rich_text: [{ text: { content: brief.corpCode ?? "" } }] },
      "법인구분": { select: { name: brief.corpCls || "기타" } },
      "재무 등급": { select: { name: brief.grade } },
      "최근 매출": { number: toB(latestYear?.revenue ?? null) },
      "영업이익률": {
        number:
          brief.financials.ratios.operatingMargin !== null
            ? Math.round(brief.financials.ratios.operatingMargin * 10) / 10
            : null,
      },
      "핵심 리스크": {
        multi_select: riskNames.map((n) => ({ name: truncate(n, 100) })),
      },
      "집중 영역 (Top 3)": { rich_text: [{ text: { content: truncate(focusSummary, 2000) } }] },
      "검증일": { date: { start: new Date().toISOString().slice(0, 10) } },
      "출처 신뢰도": { select: { name: brief.reliability } },
      "다음 재검토일": { date: { start: todayPlusSixMonths() } },
      "비고": { rich_text: [{ text: { content: brief.executiveSummary } }] },
    },
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ text: { content: "검증 브리프" } }] },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: brief.executiveSummary } }] },
      },
      {
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: `재무 등급: ${brief.grade}` } }] },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: brief.financials.ratios ? `영업이익률 ${brief.financials.ratios.operatingMargin?.toFixed(1) ?? "N/A"}% | 부채비율 ${brief.financials.ratios.debtRatio?.toFixed(0) ?? "N/A"}% | 유동비율 ${brief.financials.ratios.currentRatio?.toFixed(0) ?? "N/A"}%` : "" } }] },
      },
      {
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: "핵심 리스크" } }] },
      },
      ...brief.riskFlags.slice(0, 5).map((r) => ({
        object: "block" as const,
        type: "bulleted_list_item" as const,
        bulleted_list_item: {
          rich_text: [{ text: { content: `[${r.source}] ${r.flag}: ${r.description}` } }],
        },
      })),
      {
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: "미팅 질문지" } }] },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: truncate(questionsText, 2000) } }] },
      },
    ],
  });

  const pageUrl = `https://notion.so/${page.id.replace(/-/g, "")}`;

  await writeNewsToNotion(brief.news, page.id, brief.companyName);

  return { pageId: page.id, url: pageUrl };
}

async function writeNewsToNotion(news: NewsArticle[], tenantPageId: string, companyName: string): Promise<void> {
  const notion = getNotionClient();
  if (!notion || !NEWS_DB_ID) return;

  const top = news.slice(0, 20);
  for (const item of top) {
    try {
      await notion.pages.create({
        parent: { database_id: NEWS_DB_ID },
        properties: {
          "제목": { title: [{ text: { content: truncate(item.title, 200) } }] },
          "회사": { rich_text: [{ text: { content: companyName } }] },
          "보도일": { date: { start: new Date(item.pubDate).toISOString().slice(0, 10) } },
          "카테고리": { select: { name: item.category } },
          "요약": { rich_text: [{ text: { content: truncate(item.description, 2000) } }] },
          "신뢰도": { select: { name: item.reliability } },
          "URL": { url: item.originallink },
        },
      });
    } catch {
      // 개별 뉴스 저장 실패는 무시
    }
  }
}
