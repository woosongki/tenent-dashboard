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
import type { VerifyBrief, VerifyProgressEvent, VerifyRequest } from "./types";

export async function* runVerifyPipeline(
  request: VerifyRequest
): AsyncGenerator<VerifyProgressEvent> {
  const { company, memo } = request;
  const collectedAt = new Date().toISOString();

  yield { type: "progress", step: "corp-search", message: `DART에서 "${company}" 검색 중...` };

  const corpEntry = searchCorpCode(company);
  if (!corpEntry) {
    yield {
      type: "progress",
      step: "corp-search",
      message: `DART corp-codes.json에 "${company}"가 없습니다. DART 고유번호를 직접 입력하거나 scripts/dart-sync-corp-codes.mjs를 실행하세요.`,
    };
  }
  const corpCode = corpEntry?.code ?? "";

  yield { type: "progress", step: "company-info", message: "DART 기업 기본정보 수집 중..." };
  const companyInfo = corpCode ? await fetchCompanyInfo(corpCode) : null;

  yield { type: "progress", step: "financials", message: "DART 3개년 재무제표 수집 중..." };
  const financials = corpCode ? await fetchFinancials(corpCode) : [];

  yield { type: "progress", step: "disclosures", message: "DART 수시공시 이력 수집 중..." };
  const disclosures = corpCode ? await fetchDisclosures(corpCode) : [];

  yield { type: "progress", step: "shareholders", message: "DART 최대주주 현황 수집 중..." };
  const shareholders = corpCode ? await fetchMajorShareholders(corpCode) : [];

  yield { type: "progress", step: "news", message: "네이버에서 최근 12개월 뉴스 검색 중..." };
  const news = await fetchNews(company);
  yield { type: "progress", step: "news", message: `뉴스 ${news.length}건 수집 완료` };

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
