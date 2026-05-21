import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  DartCompany,
  FinancialYear,
  DartDisclosure,
  MajorShareholder,
  NewsArticle,
  VerifyGrade,
  RiskFlag,
  FocusArea,
  MeetingQuestion,
  FinancialRatios,
  AttractionMatch,
  VendorMatch,
  SalesBenchmark,
  SearchTrend,
  BusinessSwot,
} from "./types";

function calcRatios(years: FinancialYear[]): FinancialRatios {
  const latest = years[0];
  if (!latest) {
    return {
      operatingMargin: null,
      debtRatio: null,
      currentRatio: null,
      interestCoverageRatio: null,
      isCapitalImpaired: false,
    };
  }
  const operatingMargin =
    latest.revenue && latest.operatingProfit !== null
      ? (latest.operatingProfit / latest.revenue) * 100
      : null;
  const debtRatio =
    latest.totalLiabilities !== null && latest.totalEquity
      ? (latest.totalLiabilities / latest.totalEquity) * 100
      : null;
  const currentRatio =
    latest.currentAssets && latest.currentLiabilities
      ? (latest.currentAssets / latest.currentLiabilities) * 100
      : null;
  const interestCoverageRatio =
    latest.operatingProfit !== null && latest.interestExpense
      ? latest.operatingProfit / latest.interestExpense
      : null;
  const isCapitalImpaired = latest.totalEquity !== null ? latest.totalEquity <= 0 : false;

  return { operatingMargin, debtRatio, currentRatio, interestCoverageRatio, isCapitalImpaired };
}

function formatFinancials(years: FinancialYear[]): string {
  const toB = (n: number | null) => (n === null ? "확인 불가" : `${(n / 1e8).toFixed(0)}억원`);
  const toPct = (n: number | null) => (n === null ? "확인 불가" : `${n.toFixed(1)}%`);

  return years
    .map(
      (y) =>
        `${y.year}년: 매출 ${toB(y.revenue)}, 영업이익 ${toB(y.operatingProfit)}, 순이익 ${toB(y.netIncome)}, 자본 ${toB(y.totalEquity)}, 부채 ${toB(y.totalLiabilities)}`
    )
    .join("\n");
}

function formatDisclosures(ds: DartDisclosure[]): string {
  if (ds.length === 0) return "없음";
  // T1-2: 20→10건, 짧은 포맷
  return ds.slice(0, 10).map((d) => `${d.rceptDt} ${d.rceptNm}`).join("\n");
}

function formatShareholders(sh: MajorShareholder[]): string {
  if (sh.length === 0) return "확인 불가";
  // T1-2: 5→3건
  return sh.slice(0, 3).map((s) => `${s.nm}(${s.relate}) ${s.trmend_posesn_stock_qota_rt}%`).join("\n");
}

function formatNews(news: NewsArticle[]): string {
  if (news.length === 0) return "없음";
  // T1-2: 30→12건, description 짧게(80자), 카테고리 압축
  return news
    .slice(0, 12)
    .map((n) => {
      const desc = n.description.length > 80 ? n.description.slice(0, 80) + "…" : n.description;
      return `[${n.pubDate.slice(5, 10)} ${n.category}] ${n.title} — ${desc}`;
    })
    .join("\n");
}

export interface AnalysisResult {
  grade: VerifyGrade;
  gradeReason: string;
  riskFlags: RiskFlag[];
  focusAreas: FocusArea[];
  questions: MeetingQuestion[];
  executiveSummary: string;
}

function formatInternalHistory(history?: { attraction: AttractionMatch[]; vendor: VendorMatch[] }): string {
  if (!history || (history.attraction.length === 0 && history.vendor.length === 0)) return "내부 DB 매칭 없음";
  const lines: string[] = [];
  // T1-2: 5→3건씩, 짧은 포맷
  history.attraction.slice(0, 3).forEach((a) =>
    lines.push(`입점:${a.brandName}|${a.branch ?? "-"}${a.floor ?? ""}|${a.category ?? "-"}|${a.status}`)
  );
  history.vendor.slice(0, 3).forEach((v) =>
    lines.push(`업체:${v.name}(${v.source})|${v.status ?? "-"}|키맨:${v.keyman ?? "-"}`)
  );
  return lines.join("\n");
}

function formatSalesBenchmark(bench?: SalesBenchmark | null): string {
  if (!bench) return "자체 매출 데이터 없음";
  const toB = (won: number | null) => (won === null ? "-" : `${Math.round(won / 1e8)}억원`);
  const lines: string[] = [];
  if (bench.ourBrandFound && bench.ourBrandStats) {
    lines.push(`★ 본사 자체 매출 데이터 있음 (이미 입점 중): ${bench.ourBrandStats.name}`);
    lines.push(`  - 매출 ${toB(bench.ourBrandStats.revenueWon)}, 영업이익률 ${bench.ourBrandStats.marginPct.toFixed(1)}%, 매출 성장 ${bench.ourBrandStats.revenueGrowth >= 0 ? "+" : ""}${bench.ourBrandStats.revenueGrowth.toFixed(1)}%`);
  }
  if (bench.groupName) {
    lines.push(`동종 카테고리 평균 (${bench.groupName}, ${bench.peerCount}개 브랜드):`);
    lines.push(`  - 평균 매출 ${toB(bench.peerAvgRevenueWon)}, 평균 영업이익률 ${bench.peerAvgMarginPct?.toFixed(1) ?? "-"}%, 평균 성장 ${bench.peerAvgGrowthPct?.toFixed(1) ?? "-"}%`);
  }
  lines.push(`전사 평균: 매출 ${toB(bench.overall.totalRevenueWon)}, 영업이익률 ${bench.overall.avgMarginPct.toFixed(1)}%, 성장 ${bench.overall.revenueGrowthPct.toFixed(1)}%`);
  return lines.join("\n");
}

function formatTrend(trend?: SearchTrend | null): string {
  if (!trend) return "검색 트렌드 데이터 없음 (네이버 데이터랩 스코프 미연동 가능성)";
  const dir = trend.momentum === "rising" ? "상승세" : trend.momentum === "declining" ? "하락세" : "유지";
  return `네이버 검색 트렌드 (최근 12개월, 피크월=100 기준):
- 모멘텀: ${dir} (최근 3개월 ${trend.recent3MonthAvg} vs 직전 3개월 ${trend.prev3MonthAvg}, ${trend.momentumPct >= 0 ? "+" : ""}${trend.momentumPct}%)
- 피크: ${trend.peakMonth} (${trend.peakRatio})
- 최근 6개월 추이: ${trend.monthly.slice(-6).map(m => m.month.slice(-2) + "월 " + m.ratio).join(" → ")}`;
}

export async function analyzeWithClaude(params: {
  company: DartCompany | null;
  companyName: string;
  financials: FinancialYear[];
  disclosures: DartDisclosure[];
  shareholders: MajorShareholder[];
  news: NewsArticle[];
  internalHistory?: { attraction: AttractionMatch[]; vendor: VendorMatch[] };
  salesBenchmark?: SalesBenchmark | null;
  searchTrend?: SearchTrend | null;
}): Promise<AnalysisResult> {
  const ratios = calcRatios(params.financials);
  const ratioStr = [
    `영업이익률: ${ratios.operatingMargin?.toFixed(1) ?? "확인 불가"}%`,
    `부채비율: ${ratios.debtRatio?.toFixed(0) ?? "확인 불가"}%`,
    `유동비율: ${ratios.currentRatio?.toFixed(0) ?? "확인 불가"}%`,
    `이자보상배율: ${ratios.interestCoverageRatio?.toFixed(1) ?? "확인 불가"}`,
    `자본잠식: ${ratios.isCapitalImpaired ? "예" : "아니오"}`,
  ].join(", ");

  // T1-1: 시스템 프롬프트는 매번 동일 → 캐싱 대상 (5분 TTL, 90% 할인)
  const systemPrompt = `당신은 이랜드리테일 임대 협상팀의 컨텐츠 검증 전문가입니다. DART 공시·뉴스·내부 데이터를 종합해 입점 의사결정용 구조화 브리프를 작성합니다.

[출처 표시]
- DART 확인 = "검증됨"
- 복수 언론 = "보도 확인"
- 단일 매체 = "참고"
- 추정 금지 → "확인 불가"

[재무 등급]
A: 영업이익률 5%↑·부채비율 200%↓·유동비율 100%↑·자본잠식 없음·감사 적정
B: 기준 일부 미달, 치명적 리스크 없음
C: 영업이익 적자 / 부채비율 400%↑ / 자본 부분잠식
D: 자본 완전잠식 / 감사 비적정 / 계속기업 불확실 / 회생·파산

[중요]
- 자체 매출 데이터·검색 트렌드·내부 입점이력은 등급 근거에 인용
- 반드시 submit_brief 도구로 응답`;

  const userPrompt = `분석 대상: ${params.companyName}
법인구분: ${params.company?.corpCls ?? "확인 불가"}
대표이사: ${params.company?.repName ?? "확인 불가"}
설립일: ${params.company?.est_dt ?? "확인 불가"}

[재무 3개년 — DART 검증됨]
${formatFinancials(params.financials)}
주요 비율: ${ratioStr}

[최대주주 — DART 검증됨]
${formatShareholders(params.shareholders)}

[수시공시 이력 — DART 검증됨]
${formatDisclosures(params.disclosures)}

[최근 3개월 뉴스]
${formatNews(params.news)}

[이랜드 내부 데이터]
${formatInternalHistory(params.internalHistory)}

[자체 매출 벤치마크]
${formatSalesBenchmark(params.salesBenchmark)}

[시장 신호]
${formatTrend(params.searchTrend)}

위 정보를 분석하여 submit_brief 도구를 호출하세요.
- riskFlags: 최대 5개, 심각도 순
- focusAreas: 7개 카테고리 중 유의미한 것 최대 5개
- questions: 10~15개, 카테고리 균형 있게
- gradeReason: 자체 매출 데이터 / 검색 트렌드 / 내부 입점 이력이 있으면 등급 근거에 인용
- executiveSummary: 내부 데이터로 확인된 사실(이미 입점 중, 자체 매출 등)은 명확히 반영`;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // T1-3: 출력 trim — description 짧게, maxItems 축소
  // T1-1: 도구 정의는 매번 동일 → cache_control로 캐싱
  const briefTool: Anthropic.Tool = {
    name: "submit_brief",
    description: "컨텐츠 검증 브리프 제출",
    input_schema: {
      type: "object",
      properties: {
        grade: { type: "string", enum: ["A", "B", "C", "D", "미확인"] },
        gradeReason: { type: "string", description: "2문장" },
        riskFlags: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              flag: { type: "string" },
              description: { type: "string" },
              source: { type: "string", enum: ["검증됨", "보도 확인", "참고"] },
            },
            required: ["flag", "description", "source"],
          },
        },
        focusAreas: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["출점·매장 전략", "카테고리 확장", "인프라·물류", "법적·규제 이슈", "인사·조직 변동", "재무 이벤트", "온·오프 연계", "기타"],
              },
              summary: { type: "string" },
              implication: { type: "string", description: "협상 함의 1문장" },
              source: { type: "string", enum: ["검증됨", "보도 확인", "참고"] },
            },
            required: ["category", "summary", "implication", "source"],
          },
        },
        questions: {
          type: "array",
          minItems: 8,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["의사결정 권한", "거래구조", "출점·확장", "임대조건", "리스크 해명"] },
              question: { type: "string" },
            },
            required: ["category", "question"],
          },
        },
        executiveSummary: { type: "string", description: "1문장" },
      },
      required: ["grade", "gradeReason", "riskFlags", "focusAreas", "questions", "executiveSummary"],
    },
  };

  // T1-1: Anthropic prompt caching — system + tools에 cache_control 적용
  // 첫 호출 후 5분 내 동일 system/tools 재사용 시 90% 할인
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    tools: [
      { ...briefTool, cache_control: { type: "ephemeral" } } as Anthropic.Tool,
    ],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude가 submit_brief 도구를 호출하지 않음");
  }

  const result = toolUse.input as AnalysisResult;
  return { ...result, grade: result.grade ?? "미확인" };
}

export { calcRatios };

// ─────────────────────────────────────────────────────────────
// A3 + B2: 사업/감사보고서 본문 SWOT 분석 (별도 Claude 호출)
// 비용: 입력 ~5K 토큰 (캐시 적용 가능), 출력 ~800 토큰 (~$0.015/건, 30일 캐시 시 1회만)
// ─────────────────────────────────────────────────────────────
export async function analyzeBusinessSwot(params: {
  companyName: string;
  reportType: "사업보고서" | "감사보고서" | "기타";
  reportDate: string;
  bodyText: string;
}): Promise<BusinessSwot | null> {
  if (!params.bodyText || params.bodyText.length < 300) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `당신은 DART 사업보고서/감사보고서 분석 전문가입니다.
임대 협상에 도움될 SWOT 정보를 본문에서 추출합니다.

규칙:
- 본문에 명시된 사실만 추출 (추정 금지)
- 회사 자체 진술 (시장점유율 등)은 그대로 인용
- 핵심감사사항(KAM)·강조사항·계속기업 불확실성은 정확히 식별
- 영문 약어·전문 용어는 한국어로 풀어서

submit_swot 도구로만 응답.`;

  const userPrompt = `회사: ${params.companyName}
보고서: ${params.reportType} (접수일 ${params.reportDate})

[본문 발췌]
${params.bodyText}

위 본문에서 SWOT·시장점유율·핵심감사사항·계속기업 강조사항 추출.`;

  const swotTool: Anthropic.Tool = {
    name: "submit_swot",
    description: "사업/감사보고서 SWOT 분석 결과 제출",
    input_schema: {
      type: "object",
      properties: {
        strengths: {
          type: "array",
          maxItems: 4,
          items: { type: "string", description: "1문장" },
        },
        weaknesses: {
          type: "array",
          maxItems: 4,
          items: { type: "string", description: "1문장" },
        },
        opportunities: {
          type: "array",
          maxItems: 3,
          items: { type: "string", description: "1문장" },
        },
        threats: {
          type: "array",
          maxItems: 3,
          items: { type: "string", description: "1문장" },
        },
        marketShare: {
          type: "string",
          description: "회사 자체 진술 시장점유율 (예: '국내 잡화시장 점유율 45%'). 없으면 'N/A'",
        },
        keyAuditMatters: {
          type: "array",
          maxItems: 3,
          items: { type: "string", description: "핵심감사사항 KAM 1문장" },
        },
        goingConcernNote: {
          type: "string",
          description: "계속기업 불확실성·강조사항 요약. 없으면 'N/A'",
        },
      },
      required: ["strengths", "weaknesses", "opportunities", "threats", "marketShare", "keyAuditMatters", "goingConcernNote"],
    },
  };

  try {
    // 옵션 1: SWOT 추출은 Haiku 4.5로 (Sonnet 대비 4배 저렴, 패턴 매칭 작업이라 품질 영향 적음)
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      tools: [{ ...swotTool, cache_control: { type: "ephemeral" } } as Anthropic.Tool],
      tool_choice: { type: "tool", name: "submit_swot" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const input = toolUse.input as {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
      marketShare: string;
      keyAuditMatters: string[];
      goingConcernNote: string;
    };

    return {
      reportType: params.reportType,
      reportDate: params.reportDate,
      strengths: input.strengths,
      weaknesses: input.weaknesses,
      opportunities: input.opportunities,
      threats: input.threats,
      marketShare: input.marketShare && input.marketShare !== "N/A" ? input.marketShare : null,
      keyAuditMatters: input.keyAuditMatters,
      goingConcernNote: input.goingConcernNote && input.goingConcernNote !== "N/A" ? input.goingConcernNote : null,
    };
  } catch {
    return null;
  }
}
