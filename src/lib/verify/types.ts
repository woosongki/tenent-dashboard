export type VerifyGrade = "A" | "B" | "C" | "D" | "미확인";
export type SourceReliability = "검증됨" | "보도 확인" | "참고" | "확인 불가";

export interface DartCompany {
  corpCode: string;
  corpName: string;
  stockCode: string | null;
  corpCls: "Y" | "K" | "N" | "E" | null; // 상장구분
  repName: string | null;         // 대표자명
  bizrNo: string | null;          // 사업자번호
  jurir_no: string | null;        // 법인번호
  adres: string | null;           // 주소
  hm_url: string | null;
  ir_url: string | null;
  phn_no: string | null;
  induty_code: string | null;     // 업종코드
  est_dt: string | null;          // 설립일
  acc_mt: string | null;          // 결산월
}

export interface FinancialYear {
  year: number;
  revenue: number | null;         // 매출액 (원)
  operatingProfit: number | null; // 영업이익
  netIncome: number | null;       // 당기순이익
  totalAssets: number | null;     // 자산총계
  totalLiabilities: number | null; // 부채총계
  totalEquity: number | null;     // 자본총계
  currentAssets: number | null;   // 유동자산
  currentLiabilities: number | null; // 유동부채
  interestExpense: number | null; // 이자비용 (이자보상배율 계산용)
  auditOpinion: string | null;    // 감사의견
}

export interface FinancialRatios {
  operatingMargin: number | null; // 영업이익률 %
  debtRatio: number | null;       // 부채비율 %
  currentRatio: number | null;    // 유동비율 %
  interestCoverageRatio: number | null; // 이자보상배율
  isCapitalImpaired: boolean;     // 자본잠식 여부
}

export interface DartDisclosure {
  rceptNo: string;
  corpCode: string;
  corpName: string;
  rceptDt: string;     // 접수일 (yyyymmdd)
  pblntfTy: string;    // 공시유형
  pblntfTyNm: string;  // 공시유형명
  rceptNm: string;     // 공시명
}

export interface MajorShareholder {
  se: string;          // 구분 (최대주주 등)
  nm: string;          // 성명
  relate: string;      // 관계
  stock_knd: string;   // 주식종류
  bsis_posesn_stock_co: string;   // 기초보유주식수
  bsis_posesn_stock_qota_rt: string; // 기초소유비율
  trmend_posesn_stock_co: string; // 기말보유주식수
  trmend_posesn_stock_qota_rt: string; // 기말소유비율
}

export interface NewsArticle {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
  category: NewsCategory;
  reliability: SourceReliability;
}

export type NewsCategory =
  | "출점·매장 전략"
  | "카테고리 확장"
  | "인프라·물류"
  | "법적·규제 이슈"
  | "인사·조직 변동"
  | "재무 이벤트"
  | "온·오프 연계"
  | "기타";

export interface RiskFlag {
  flag: string;
  description: string;
  source: SourceReliability;
}

export interface FocusArea {
  category: NewsCategory;
  summary: string;
  implication: string;
  source: SourceReliability;
}

export interface MeetingQuestion {
  category: "의사결정 권한" | "거래구조" | "출점·확장" | "임대조건" | "리스크 해명";
  question: string;
}

export interface VerifyBrief {
  corpCode: string;
  companyName: string;
  brandName: string | null;
  bizrNo: string | null;
  corpCls: string;
  industry: string | null;
  grade: VerifyGrade;
  gradeReason: string;
  riskFlags: RiskFlag[];
  financials: {
    years: FinancialYear[];
    ratios: FinancialRatios;
    latestRevenueBillionKrw: number | null;
    latestOperatingMarginPct: number | null;
  };
  majorShareholders: MajorShareholder[];
  recentDisclosures: DartDisclosure[];
  news: NewsArticle[];
  focusAreas: FocusArea[];
  questions: MeetingQuestion[];
  executiveSummary: string;
  reliability: SourceReliability;
  collectedAt: string; // ISO timestamp
  notionPageId: string | null;
  notionUrl: string | null;
}

export interface VerifyProgressEvent {
  type: "progress" | "result" | "error" | "done";
  step?: string;
  message: string;
  data?: Partial<VerifyBrief>;
}

export interface VerifyRequest {
  company: string;
  corpCode?: string;  // UI에서 후보 선택 후 직접 지정 가능 (검색 단계 스킵)
  priority?: "urgent" | "standard";
  memo?: string;
  meetingDate?: string;
}
