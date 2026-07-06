// 상권분석 10개 리테일 카테고리 + ERP 복종(raw cat) → 카테고리 매핑.
// categoryGap.ts / categoryRatios.ts 공용(순환 import 방지용 분리).

export const RETAIL_CATEGORIES = [
  "캐주얼", "잡화", "영캐주얼", "남성의류", "아동의류",
  "여성의류", "스포츠", "하이퍼", "F&B", "라이프스타일",
] as const;
export type RetailCategory = (typeof RETAIL_CATEGORIES)[number];

/**
 * ERP 복종 라벨(예: "영캐쥬얼(특정)2001", "여성의류(특정)NC")을 10개 카테고리로 매핑.
 * 매핑 불가(외식/카페 등 세분류)면 null → 호출부에서 '미분류'로 집계.
 * 순서 주의: 더 구체적인 규칙(영캐)을 일반 규칙(캐주얼)보다 먼저 검사.
 */
export function mapCatToRetail(rawCat: string): RetailCategory | null {
  const c = rawCat.replace(/\s+/g, "");
  if (/영캐/.test(c)) return "영캐주얼";
  if (/캐쥬얼|캐주얼/.test(c)) return "캐주얼";
  if (/잡화/.test(c)) return "잡화";
  if (/남성/.test(c)) return "남성의류";
  if (/아동|유아|키즈/.test(c)) return "아동의류";
  if (/여성/.test(c)) return "여성의류";
  if (/스포츠/.test(c)) return "스포츠";
  if (/하이퍼|대형마트|마트/.test(c)) return "하이퍼";
  if (/F&B|f&b|에프앤비|식음|외식|카페|푸드|델리/.test(c)) return "F&B";
  if (/라이프|리빙|생활|가전|가구|홈/.test(c)) return "라이프스타일";
  return null;
}

export interface WeakCategory { cat: RetailCategory; myPct: number; cohortAvg: number; gap: number; }

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 빈(약한) 카테고리 판정 — 순수 함수(서버 의존 없음, 테스트 용이).
 * 판정: 내 비중 < cohort 평균의 70% OR (cohort평균 − 내비중) ≥ 3%p. gap 큰 순 정렬.
 * @param myRatios 이 점포의 카테고리 비중(%)
 * @param peerRatiosList cohort(자기 제외) 점포들의 비중(%) 목록
 */
export function detectWeakCategories(
  myRatios: Record<string, number>,
  peerRatiosList: Record<string, number>[],
): WeakCategory[] {
  const weak: WeakCategory[] = [];
  for (const cat of RETAIL_CATEGORIES) {
    const peerVals = peerRatiosList
      .map((r) => r[cat])
      .filter((v): v is number => typeof v === "number");
    if (peerVals.length === 0) continue;
    const cohortAvg = peerVals.reduce((a, b) => a + b, 0) / peerVals.length;
    const myPct = myRatios[cat] ?? 0;
    const gap = cohortAvg - myPct;
    if (gap > 0 && (myPct < cohortAvg * 0.7 || gap >= 3)) {
      weak.push({ cat, myPct: round1(myPct), cohortAvg: round1(cohortAvg), gap: round1(gap) });
    }
  }
  weak.sort((a, b) => b.gap - a.gap);
  return weak;
}
