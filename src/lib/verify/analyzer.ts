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
  if (ds.length === 0) return "최근 24개월 수시공시 없음";
  return ds
    .slice(0, 20)
    .map((d) => `${d.rceptDt} [${d.pblntfTyNm}] ${d.rceptNm}`)
    .join("\n");
}

function formatShareholders(sh: MajorShareholder[]): string {
  if (sh.length === 0) return "확인 불가";
  return sh
    .slice(0, 5)
    .map((s) => `${s.nm} (${s.relate}): ${s.trmend_posesn_stock_qota_rt}%`)
    .join("\n");
}

function formatNews(news: NewsArticle[]): string {
  if (news.length === 0) return "최근 뉴스 없음";
  return news
    .slice(0, 30)
    .map((n) => `[${n.pubDate.slice(0, 16)}] [${n.category}] ${n.title}\n${n.description}`)
    .join("\n\n");
}

export interface AnalysisResult {
  grade: VerifyGrade;
  gradeReason: string;
  riskFlags: RiskFlag[];
  focusAreas: FocusArea[];
  questions: MeetingQuestion[];
  executiveSummary: string;
}

export async function analyzeWithClaude(params: {
  company: DartCompany | null;
  companyName: string;
  financials: FinancialYear[];
  disclosures: DartDisclosure[];
  shareholders: MajorShareholder[];
  news: NewsArticle[];
}): Promise<AnalysisResult> {
  const ratios = calcRatios(params.financials);
  const ratioStr = [
    `영업이익률: ${ratios.operatingMargin?.toFixed(1) ?? "확인 불가"}%`,
    `부채비율: ${ratios.debtRatio?.toFixed(0) ?? "확인 불가"}%`,
    `유동비율: ${ratios.currentRatio?.toFixed(0) ?? "확인 불가"}%`,
    `이자보상배율: ${ratios.interestCoverageRatio?.toFixed(1) ?? "확인 불가"}`,
    `자본잠식: ${ratios.isCapitalImpaired ? "예" : "아니오"}`,
  ].join(", ");

  const systemPrompt = `당신은 이랜드리테일 임대 협상팀을 위한 테넌트 검증 전문가입니다.
DART 공시 데이터와 뉴스를 분석하여 구조화된 검증 브리프를 작성합니다.

규칙:
- DART 직접 확인 데이터는 "검증됨"으로 표시
- 복수 언론 확인 정보는 "보도 확인"으로 표시
- 단일 매체 정보는 "참고"로 표시
- 확인 안 된 정보는 절대 추정하지 않고 "확인 불가" 표시
- 회사 자체 주장(시장점유율 등)은 "참고"로 표시

재무 등급 기준:
A (안전): 영업이익률 5%↑, 부채비율 200%↓, 유동비율 100%↑, 자본잠식 없음, 감사의견 적정
B (조건부): 기준 일부 미달 but 치명적 리스크 없음
C (주의): 영업이익률 음수 또는 부채비율 400%↑ 또는 자본잠식 부분
D (부적합): 자본완전잠식, 감사의견 비적정, 계속기업 불확실성, 회생/파산

출력은 반드시 아래 JSON 형식으로만 응답:
{
  "grade": "A"|"B"|"C"|"D"|"미확인",
  "gradeReason": "2-3문장",
  "riskFlags": [{"flag": "...", "description": "...", "source": "검증됨"|"보도 확인"|"참고"}],
  "focusAreas": [{"category": "...", "summary": "...", "implication": "협상 함의 1문장", "source": "검증됨"|"보도 확인"|"참고"}],
  "questions": [{"category": "의사결정 권한"|"거래구조"|"출점·확장"|"임대조건"|"리스크 해명", "question": "..."}],
  "executiveSummary": "1문장 핵심 요약"
}`;

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

[최근 12개월 뉴스]
${formatNews(params.news)}

위 정보를 분석하여 테넌트 검증 브리프 JSON을 작성하세요.
- riskFlags: 최대 5개, 심각도 순
- focusAreas: 7개 카테고리 중 유의미한 것 최대 5개
- questions: 10~15개, 카테고리 균형 있게`;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude 응답 없음");

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude 응답에서 JSON 파싱 실패");

  const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;
  return { ...parsed, grade: parsed.grade ?? "미확인" };
}

export { calcRatios };
