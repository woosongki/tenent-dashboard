import "server-only";
import {
  searchCorpCode,
  fetchCompanyInfo,
  fetchFinancials,
  fetchDisclosures,
  fetchMajorShareholders,
} from "./dart";
import { fetchNews } from "./news";
import { analyzeWithClaude, calcRatios } from "./analyzer";
import { writeBriefToNotion } from "./notionWriter";
import { findExistingTenancy, buildSalesBenchmark } from "./internal";
import { fetchSearchTrend } from "./trend";
import type { VerifyBrief, VerifyProgressEvent, VerifyRequest } from "./types";

export async function* runVerifyPipeline(
  request: VerifyRequest
): AsyncGenerator<VerifyProgressEvent> {
  const { company } = request;
  const collectedAt = new Date().toISOString();

  let corpCode = request.corpCode ?? "";

  if (corpCode) {
    yield { type: "progress", step: "corp-search", message: `DART corp_code ${corpCode} 사용 (사용자 선택)` };
  } else {
    yield { type: "progress", step: "corp-search", message: `DART에서 "${company}" 검색 중...` };
    const corpEntry = searchCorpCode(company);
    if (!corpEntry) {
      yield {
        type: "progress",
        step: "corp-search",
        message: `DART corp-codes.json에 "${company}"가 없습니다. DART 고유번호를 직접 입력하거나 scripts/dart-sync-corp-codes.mjs를 실행하세요.`,
      };
    } else {
      yield { type: "progress", step: "corp-search", message: `DART 매칭: ${corpEntry.name} (${corpEntry.code})` };
    }
    corpCode = corpEntry?.code ?? "";
  }

  yield { type: "progress", step: "company-info", message: "DART 기업 기본정보 수집 중..." };
  const companyInfo = corpCode ? await fetchCompanyInfo(corpCode) : null;

  yield { type: "progress", step: "financials", message: "DART 3개년 재무제표 수집 중..." };
  const financials = corpCode ? await fetchFinancials(corpCode) : [];

  yield { type: "progress", step: "disclosures", message: "DART 수시공시 이력 수집 중..." };
  const disclosures = corpCode ? await fetchDisclosures(corpCode) : [];

  yield { type: "progress", step: "shareholders", message: "DART 최대주주 현황 수집 중..." };
  const shareholders = corpCode ? await fetchMajorShareholders(corpCode) : [];

  yield { type: "progress", step: "news", message: "네이버에서 최근 3개월 뉴스 검색 중..." };
  const news = await fetchNews(company);
  yield { type: "progress", step: "news", message: `뉴스 ${news.length}건 수집 완료` };

  // ── 신규: 내부 데이터 + 시장 신호 (병렬) ────────────────────────
  yield { type: "progress", step: "internal", message: "이랜드 내부 데이터 + 네이버 검색 트렌드 조회 중..." };
  const [internalHistory, salesBenchmark, searchTrend] = await Promise.all([
    findExistingTenancy(company, null),
    Promise.resolve(buildSalesBenchmark(company, null)),
    fetchSearchTrend(company),
  ]);
  const internalSummary: string[] = [];
  if (internalHistory.attraction.length > 0) internalSummary.push(`기존 입점 후보 ${internalHistory.attraction.length}건`);
  if (internalHistory.vendor.length > 0) internalSummary.push(`업체리스트 ${internalHistory.vendor.length}건`);
  if (salesBenchmark?.ourBrandFound) internalSummary.push(`자체 매출 데이터 ${salesBenchmark.ourBrandStats?.name}`);
  if (searchTrend) internalSummary.push(`검색 트렌드 ${searchTrend.momentum === "rising" ? "↑" : searchTrend.momentum === "declining" ? "↓" : "→"} ${searchTrend.momentumPct > 0 ? "+" : ""}${searchTrend.momentumPct}%`);
  yield {
    type: "progress",
    step: "internal",
    message: internalSummary.length > 0 ? internalSummary.join(" / ") : "내부 매칭 없음 / 트렌드 데이터 없음",
  };

  yield { type: "progress", step: "analysis", message: "Claude로 재무 진단·리스크 분류 중..." };

  let analysis;
  try {
    analysis = await analyzeWithClaude({
      company: companyInfo,
      companyName: company,
      financials,
      disclosures,
      shareholders,
      news,
      internalHistory,
      salesBenchmark,
      searchTrend,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    yield { type: "error", message: `Claude 분석 실패: ${msg}` };
    return;
  }

  const ratios = calcRatios(financials);
  const latestYear = financials[0];

  const corpClsMap: Record<string, string> = {
    Y: "상장(유가증권)",
    K: "상장(코스닥)",
    N: "상장(코넥스)",
    E: "외감 비상장",
  };

  const brief: VerifyBrief = {
    corpCode,
    companyName: company,
    brandName: null,
    bizrNo: companyInfo?.bizrNo ?? null,
    corpCls: companyInfo?.corpCls ? (corpClsMap[companyInfo.corpCls] ?? "기타") : "미확인",
    industry: null,
    grade: analysis.grade,
    gradeReason: analysis.gradeReason,
    riskFlags: analysis.riskFlags,
    financials: {
      years: financials,
      ratios,
      latestRevenueBillionKrw: latestYear?.revenue ? Math.round(latestYear.revenue / 1e8) : null,
      latestOperatingMarginPct: ratios.operatingMargin,
    },
    majorShareholders: shareholders,
    recentDisclosures: disclosures,
    news,
    focusAreas: analysis.focusAreas,
    questions: analysis.questions,
    executiveSummary: analysis.executiveSummary,
    reliability: corpCode ? (news.length > 0 ? "보도 확인" : "검증됨") : "일부 추정" as VerifyBrief["reliability"],
    collectedAt,
    notionPageId: null,
    notionUrl: null,
    internalHistory,
    salesBenchmark,
    searchTrend,
  };

  yield { type: "progress", step: "notion", message: "Notion에 검증 결과 저장 중..." };
  try {
    const notionResult = await writeBriefToNotion(brief);
    if (notionResult) {
      brief.notionPageId = notionResult.pageId;
      brief.notionUrl = notionResult.url;
      yield { type: "progress", step: "notion", message: "Notion 저장 완료" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    yield { type: "progress", step: "notion", message: `Notion 저장 실패 (결과는 유효): ${msg}` };
  }

  yield { type: "result", message: "검증 완료", data: brief };
  yield { type: "done", message: "파이프라인 종료" };
}
