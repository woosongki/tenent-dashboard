import "server-only";
import {
  searchCorpCandidates,
  enrichCandidates,
  searchCorpCode,
  fetchCompanyInfo,
  fetchFinancials,
  fetchDisclosures,
  type CorpCandidate,
} from "@/lib/verify/dart";
import { fetchNews } from "@/lib/verify/news";
import { fetchSearchTrend } from "@/lib/verify/trend";
import type {
  DartCompany,
  FinancialYear,
  DartDisclosure,
  NewsArticle,
  SearchTrend,
} from "@/lib/verify/types";

export interface MeetingBriefPayload {
  brand: string;                      // 사용자 입력
  company: string | null;             // DART 정식 회사명
  corpCode: string | null;
  corpCls: DartCompany["corpCls"];
  dart: DartCompany | null;
  financials: FinancialYear[];        // 최근 3년
  disclosures: DartDisclosure[];      // 최근 2년
  news: NewsArticle[];                // 최근 3개월
  trend: SearchTrend | null;          // 12개월 + 모멘텀 (DataLab 미허용 시 null)
  fetchedAt: string;                  // ISO
}

export interface MeetingBriefOptions {
  brand: string;
  corpCode?: string | null;
  /** 재무 룩백 연수 (기본 3년) */
  lookbackYears?: number;
}

/**
 * 미팅 사전 자료 수집.
 *
 * verify/pipeline의 LLM·Notion 단계를 제외하고 외부 API만 병렬 호출.
 * 한 채널이 실패해도 나머지는 살아남도록 Promise.allSettled 사용.
 */
export async function runMeetingBrief(
  opts: MeetingBriefOptions
): Promise<MeetingBriefPayload> {
  const brand = opts.brand.trim();
  const lookbackYears = opts.lookbackYears ?? 3;

  // ── DART corp 매칭 ──────────────────────────────────────────
  let corpCode = (opts.corpCode ?? "").trim();
  if (!corpCode) {
    const corpEntry = searchCorpCode(brand);
    corpCode = corpEntry?.code ?? "";
  }

  // ── 병렬 fetch: DART(있을 때) + 뉴스 + 트렌드 ───────────────
  const dartCompanyP = corpCode
    ? fetchCompanyInfo(corpCode).catch(() => null)
    : Promise.resolve(null);
  const dartFinP = corpCode
    ? fetchFinancials(corpCode, lookbackYears).catch(() => [] as FinancialYear[])
    : Promise.resolve([] as FinancialYear[]);
  const dartDiscP = corpCode
    ? fetchDisclosures(corpCode).catch(() => [] as DartDisclosure[])
    : Promise.resolve([] as DartDisclosure[]);
  const newsP = fetchNews(brand).catch(() => [] as NewsArticle[]);
  const trendP = fetchSearchTrend(brand).catch(() => null);

  const [dart, financials, disclosures, news, trend] = await Promise.all([
    dartCompanyP,
    dartFinP,
    dartDiscP,
    newsP,
    trendP,
  ]);

  return {
    brand,
    company: dart?.corpName ?? null,
    corpCode: corpCode || null,
    corpCls: dart?.corpCls ?? null,
    dart,
    financials,
    disclosures: disclosures.slice(0, 20),
    news,
    trend,
    fetchedAt: new Date().toISOString(),
  };
}

/** DART 후보 검색 — UI에서 동명이인/계열사 구분용 */
export async function listCorpCandidates(
  brand: string,
  limit = 8
): Promise<CorpCandidate[]> {
  const raw = searchCorpCandidates(brand, limit);
  if (raw.length === 0) return [];
  // 대표자명·설립일까지 채워서 반환 (DART 병렬 호출)
  return enrichCandidates(raw);
}

const KRW_BILLION = 100_000_000; // 1억

function fmtBillionKRW(won: number | null | undefined): string {
  if (!won || !Number.isFinite(won)) return "—";
  if (won >= 1_000 * KRW_BILLION) return `${(won / (1_000 * KRW_BILLION)).toFixed(1)}조`;
  if (won >= KRW_BILLION) return `${(won / KRW_BILLION).toFixed(0)}억`;
  return `${(won / 10_000).toFixed(0)}만`;
}

function calcYoY(curr: number | null, prev: number | null): number | null {
  if (!curr || !prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

/**
 * 룰 기반 요약 — LLM 없음. 한 줄짜리 TL;DR.
 *
 * 예: "F&B / 매출 230억 (YoY +30%) / 검색 모멘텀 ↑ +24% / 최근 뉴스 12건 (출점 5)"
 */
export function summarizeBrief(payload: MeetingBriefPayload): string {
  const parts: string[] = [];

  // 회사명·상장구분
  if (payload.dart) {
    const cls =
      payload.dart.corpCls === "Y"
        ? "상장"
        : payload.dart.corpCls === "K"
        ? "코스닥"
        : payload.dart.corpCls === "E"
        ? "외감"
        : null;
    parts.push(cls ? `${payload.dart.corpName} (${cls})` : payload.dart.corpName);
  }

  // 매출 + YoY
  const latest = payload.financials[0];
  const prev = payload.financials[1];
  if (latest?.revenue) {
    const yoy = calcYoY(latest.revenue, prev?.revenue ?? null);
    const yoyStr = yoy === null ? "" : ` (YoY ${yoy > 0 ? "+" : ""}${yoy}%)`;
    parts.push(`${latest.year} 매출 ${fmtBillionKRW(latest.revenue)}${yoyStr}`);
  }

  // 검색 모멘텀
  if (payload.trend) {
    const arrow =
      payload.trend.momentum === "rising"
        ? "↑"
        : payload.trend.momentum === "declining"
        ? "↓"
        : "→";
    const sign = payload.trend.momentumPct > 0 ? "+" : "";
    parts.push(`검색 ${arrow} ${sign}${payload.trend.momentumPct}%`);
  }

  // 뉴스 카운트 + 최다 카테고리
  if (payload.news.length > 0) {
    const counts = new Map<string, number>();
    payload.news.forEach((n) => counts.set(n.category, (counts.get(n.category) ?? 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    parts.push(`뉴스 ${payload.news.length}건${top ? ` (${top[0]} ${top[1]})` : ""}`);
  }

  if (parts.length === 0) return "수집된 데이터가 부족합니다. DART 등록 여부와 브랜드명을 확인해 보세요.";
  return parts.join(" · ");
}
