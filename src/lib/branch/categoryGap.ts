// 상권분석 [storeId] — 빈(약한) 카테고리 판정.
//
// 데이터(정적, build-store-*.mjs 생성 · 서버 전용):
//   store-categories.json : 점포별 10개 카테고리 매출·비중(ratio %)
//   trade-area _index     : 점포별 상권유형(tradeAreaType) → 같은 유형 = cohort
// 조인: storeName (두 소스 모두 41/41 일치 확인).
//
// 제안 브랜드는 내부(이랜드 보유) 브랜드가 아니라 외부 시장에서 찾는다 →
// externalBrands.ts(리테일 지도 인근 체인) + AI 제안(온디맨드)에서 담당.

import { getTradeAreaIndex } from "@/lib/tradeArea";
import storeCategoriesRaw from "@/data/store-categories.json";

export const RETAIL_CATEGORIES = [
  "캐주얼", "잡화", "영캐주얼", "남성의류", "아동의류",
  "여성의류", "스포츠", "하이퍼", "F&B", "라이프스타일",
] as const;
export type RetailCategory = (typeof RETAIL_CATEGORIES)[number];

interface CatStore { storeName: string; ratios: Record<string, number>; }

const catByName = new Map<string, Record<string, number>>(
  (storeCategoriesRaw as { stores: CatStore[] }).stores.map((s) => [s.storeName, s.ratios]),
);

export interface WeakCategory { cat: RetailCategory; myPct: number; cohortAvg: number; gap: number; }
export interface CategoryGap {
  tradeAreaType: string;
  cohortSize: number;   // 자기 포함 같은 유형 점포 수
  weak: WeakCategory[];  // 빈/약한 카테고리 (gap 큰 순, 최대 3)
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 점포의 카테고리 갭(상권유형 평균 대비 약한 카테고리).
 * @param storeId 라우트 슬러그 id (trade-area 인덱스 키)
 * @param storeName store-categories 조인 키
 */
export function getCategoryGap(storeId: string, storeName: string): CategoryGap | null {
  const idx = getTradeAreaIndex();
  if (!idx) return null;
  const me = idx.stores.find((s) => s.id === storeId);
  if (!me) return null;

  const cohort = idx.stores.filter((s) => s.tradeAreaType === me.tradeAreaType);
  const peerNames = cohort.map((s) => s.name).filter((n) => n !== storeName);

  // ── 빈 카테고리: cohort(자기 제외) 평균 대비 유의하게 낮은 카테고리 ──
  // 판정: 내 비중 < cohort 평균의 70% OR (cohort평균 − 내비중) ≥ 3%p. gap 큰 순 최대 3개.
  const myRatios = catByName.get(storeName);
  const weak: WeakCategory[] = [];
  if (myRatios && peerNames.length >= 1) {
    for (const cat of RETAIL_CATEGORIES) {
      const peerVals = peerNames
        .map((n) => catByName.get(n)?.[cat])
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
  }

  return { tradeAreaType: me.tradeAreaType, cohortSize: cohort.length, weak: weak.slice(0, 3) };
}
