// 매출분석 데이터 타입 (Supabase sales_* 테이블 ↔ 앱 집계)
// 전 부문(패션/F&B/기타) 수용 — division/cat/bcat은 자유 텍스트.

// 대분류(부문) — 권장값이지만 자유 확장 가능
export type Division = "패션" | "F&B" | "기타" | (string & {});
// 복종/세부 — 자유 텍스트 (여성/영캐/외식/카페/리빙 ...)
export type Cat = string;
// BCD 등급
export type Grade = "S" | "A" | "B" | "C" | "F" | "";
// 브랜드 세부 카테고리 — 부문별 상이, 자유 텍스트
export type BCat = string;

// ── 원천 행 (테이블과 1:1) ──
export interface SalesMonthlyRow {
  division: Division;
  cat: Cat;
  brand: string;
  store: string;
  ym: string;       // 'YYYY-MM'
  sales: number;
  gp: number;
}

export interface SalesStoreMeta {
  division: Division;
  cat: Cat;
  brand: string;
  store: string;
  area: number;     // 평
  grade: Grade;
  bcat: BCat;
}

export interface SalesOnlineRow {
  division: Division;
  cat: Cat;
  brand: string;
  store: string;        // 지점명
  channel: string;
  ym: string;
  sales: number;        // 온라인은 매출만 (GP 미관리)
}

// ── 집계 결과 (ACC_DATA / CUM_DATA 형태) ──
export interface AggRow {
  division: Division;
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

// ── 분류별 요약 (division 또는 cat 기준 집계) ──
export interface GroupSummary {
  key: string;      // division 또는 cat 값
  s: number;
  g: number;
  gpm: number;
  area: number;
  spd: number;
  gpd: number;
  stores: number;
}
