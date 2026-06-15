// 매출분석 데이터 타입 (Supabase sales_* 테이블 ↔ 앱 집계)

export type Cat = "여성" | "영캐";
export type Grade = "S" | "A" | "B" | "C" | "F" | "";
export type BCat =
  | "캐릭터" | "커리어" | "캐주얼" | "해외컨템"
  | "이너웨어" | "편집샵" | "온라인" | "시니어" | "";

// ── 원천 행 (테이블과 1:1) ──
export interface SalesMonthlyRow {
  cat: Cat;
  brand: string;
  store: string;
  ym: string;       // 'YYYY-MM'
  sales: number;
  gp: number;
}

export interface SalesStoreMeta {
  cat: Cat;
  brand: string;
  store: string;
  area: number;     // 평
  grade: Grade;
  bcat: BCat;
}

export interface SalesOnlineRow {
  cat: Cat;
  brand: string;
  channel: string;
  ym: string;
  sales: number;
  gp: number;
}

// ── 집계 결과 (ACC_DATA / CUM_DATA 형태) ──
export interface AggRow {
  cat: Cat;
  brand: string;
  store: string;
  s: number;        // 매출
  ps: number;       // 전년 매출
  g: number;        // 이익
  pg: number;       // 전년 이익
  gpm: number;      // 이익률 %
  area: number;     // 면적(평)
  spd: number;      // 평당 매출/일
  pspd: number;     // 전년 평당 매출/일
  gpd: number;      // 평당 이익/일
  pgpd: number;
  grade: Grade;
  bcat: BCat;
  yoyPct: number;   // 매출 전년대비 %
}

// ── 복종별 요약 (ACC_SUMMARY / CUM_SUMMARY 형태) ──
export interface CatSummary {
  s: number;
  g: number;
  gpm: number;
  area: number;
  spd: number;
  gpd: number;
  stores: number;
}
export type SummaryByCat = Record<"전체" | Cat, CatSummary>;
