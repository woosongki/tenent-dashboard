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
import { findRecentVerification } from "./cache";
import type { VerifyBrief, VerifyProgressEvent, VerifyRequest, RiskFlag, MeetingQuestion, FocusArea } from "./types";

export async function* runVerifyPipeline(
  request: VerifyRequest
): AsyncGenerator<VerifyProgressEvent> {
  const { company } = request;
  const collectedAt = new Date().toISOString();

  // ── T2-3: Notion 30일 캐시 조회 (Claude 100% 우회 가능) ────────
  yield { type: "progress", step: "cache", message: "최근 검증 이력 캐시 조회 중..." };
  const cache = await findRecentVerification(company);
  if (cache.hit) {
    yield {
      type: "progress",
      step: "cache",
      message: `✅ 캐시 적중: ${cache.daysSince}일 전 검증 완료 (등급 ${cache.grade ?? "?"}) → Claude 호출 우회 (비용 0)`,
    };
    yield {
      type: "result",
      message: "캐시된 검증 결과 반환",
      data: {
        corpCode: request.corpCode ?? "",
        companyName: company,
        brandName: null,
        bizrNo: null,
        corpCls: "캐시",
        industry: null,
        grade: (cache.grade ?? "미확인") as VerifyBrief["grade"],
        gradeReason: `${cache.daysSince}일 전 검증된 결과 (재검증 시 "다시 검증" 버튼 클릭)`,
        riskFlags: [],
        financials: { years: [], ratios: { operatingMargin: null, debtRatio: null, currentRatio: null, interestCoverageRatio: null, isCapitalImpaired: false }, latestRevenueBillionKrw: null, latestOperatingMarginPct: null },
        majorShareholders: [],
        recentDisclosures: [],
        news: [],
        focusAreas: [],
        questions: [],
        executiveSummary: cache.summary ?? "캐시된 검증 결과 — Notion 페이지에서 상세 확인",
        reliability: "검증됨" as VerifyBrief["reliability"],
        collectedAt: cache.verifiedAt,
        notionPageId: cache.notionPageId,
        notionUrl: cache.notionUrl,
      },
    };
    yield { type: "done", message: "캐시 반환 완료" };
    return;
  }
  yield { type: "progress", step: "cache", message: "캐시 없음 → 신규 검증 진행" };

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

  // ── 신규: 내부 데이터 + 시장 신호 (병렬) ────
  // 옵션 2: SWOT 자동 호출 제거 → UI에서 "사업보고서 SWOT 추가 분석" 버튼으로 opt-in
  yield { type: "progress", step: "internal", message: "이랜드 내부 데이터 + 네이버 트렌드 조회 중..." };
  const [internalHistory, salesBenchmark, searchTrend] = await Promise.all([
    findExistingTenancy(company, null),
    Promise.resolve(buildSalesBenchmark(company, null)),
    fetchSearchTrend(company),
  ]);

  // SWOT는 별도 API (/api/verify/swot)에서 사용자가 클릭 시 호출 (Haiku 사용, 약 $0.005)
  const businessSwot = null;
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

  // ── T2-1: 자본잠식 발견 시 자동 D등급, Claude 호출 우회 ────────
  const ratios = calcRatios(financials);
  let analysis;
  if (ratios.isCapitalImpaired) {
    yield {
      type: "progress",
      step: "analysis",
      message: "⚠ 자본잠식 감지 → 자동 D등급 부여 (Claude 호출 우회로 비용 0)",
    };
    const latestYear = financials[0];
    const ruleBasedRisks: RiskFlag[] = [
      { flag: "자본잠식", description: `${latestYear?.year}년 자본총계 ${latestYear?.totalEquity}원`, source: "검증됨" },
    ];
    if (ratios.debtRatio !== null && ratios.debtRatio > 400) {
      ruleBasedRisks.push({ flag: "과다 부채", description: `부채비율 ${ratios.debtRatio.toFixed(0)}%`, source: "검증됨" });
    }
    const ruleBasedQuestions: MeetingQuestion[] = [
      { category: "리스크 해명", question: "자본잠식 상태에서 임대 보증금·임대료 지급 능력을 어떻게 담보할 수 있는가?" },
      { category: "거래구조", question: "본사 또는 모회사의 지급 보증이 가능한가?" },
      { category: "리스크 해명", question: "자본 확충 계획 (유상증자·CB 발행 등)이 있는가? 시점은?" },
      { category: "임대조건", question: "수익률 기반 임대료(매출 수수료) 구조로 전환 가능한가?" },
      { category: "출점·확장", question: "이미 운영 중인 점포 중 폐점 예정이 있는가?" },
      { category: "의사결정 권한", question: "본 입점 결정의 최종 결재자는 누구이며 의사결정 일정은?" },
      { category: "리스크 해명", question: "감사보고서 강조사항·계속기업 불확실성 의견이 있었는가?" },
      { category: "거래구조", question: "단기·중기 자금 조달 계획서를 공유 가능한가?" },
    ];
    analysis = {
      grade: "D" as const,
      gradeReason: `${latestYear?.year}년 기준 자본잠식(자본총계 ${latestYear?.totalEquity?.toLocaleString()}원) 확인. 임대 보증금·임대료 지급 능력에 중대한 의문이 있어 규칙 기반 자동 D등급 부여.`,
      riskFlags: ruleBasedRisks,
      focusAreas: [] as FocusArea[],
      questions: ruleBasedQuestions,
      executiveSummary: `자본잠식 상태로 D등급 자동 분류. 본사 지급보증·수익 연동 임대료 등 리스크 완화 조건 필수.`,
    };
  } else {
    yield { type: "progress", step: "analysis", message: "Claude로 재무 진단·리스크 분류 중..." };
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
  }

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
    businessSwot,
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
