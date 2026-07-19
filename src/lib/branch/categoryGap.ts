// 상권분석 [storeId] — 빈(약한) 카테고리 판정.
//
// 카테고리 비중 소스: categoryRatios.getStoreCategoryRatios()
//   · 기본 static(store-categories.json, ERP 2026-04) — 무설정 시 기존 동작.
//   · BRANCH_CATEGORY_SOURCE=supabase 면 sales_offline_month 최신월 파생(매출 갱신을 따라감).
// 상권유형(cohort): trade-area _index (같은 tradeAreaType = cohort). 조인: storeName.
//
// 제안 브랜드는 내부(이랜드 보유) 브랜드가 아니라 외부 시장에서 찾는다 →
// externalBrands.ts(리테일 지도 인근 체인) + AI 제안(온디맨드)에서 담당.

import { getTradeAreaIndex } from "@/lib/tradeArea";
import { getStoreCategoryRatios } from "./categoryRatios";
import {
  RETAIL_CATEGORIES,
  detectWeakCategories,
  type RetailCategory,
  type WeakCategory,
} from "./retailCategories";

export { RETAIL_CATEGORIES, detectWeakCategories };
export type { RetailCategory, WeakCategory };

export interface CategoryGap {
  tradeAreaType: string;
  cohortSize: number;   // 자기 포함 같은 유형 점포 수
  weak: WeakCategory[];  // 빈/약한 카테고리 (gap 큰 순, 최대 3)
  period: string;        // 카테고리 데이터 기준(라벨용)
  source: "static" | "supabase";
}

/**
 * 점포의 카테고리 갭(상권유형 평균 대비 약한 카테고리).
 * @param storeId 라우트 슬러그 id (trade-area 인덱스 키)
 * @param storeName store-categories 조인 키
 */
export async function getCategoryGap(storeId: string, storeName: string): Promise<CategoryGap | null> {
  const idx = getTradeAreaIndex();
  if (!idx) return null;
  const me = idx.stores.find((s) => s.id === storeId);
  if (!me) return null;

  const { ratios: catByName, period, source } = await getStoreCategoryRatios();

  const cohort = idx.stores.filter((s) => s.tradeAreaType === me.tradeAreaType);
  const peerNames = cohort.map((s) => s.name).filter((n) => n !== storeName);

  const myRatios = catByName.get(storeName);
  const peerRatiosList = peerNames
    .map((n) => catByName.get(n))
    .filter((r): r is Record<string, number> => !!r);
  const weak = myRatios && peerRatiosList.length >= 1
    ? detectWeakCategories(myRatios, peerRatiosList)
    : [];

  return { tradeAreaType: me.tradeAreaType, cohortSize: cohort.length, weak: weak.slice(0, 3), period, source };
}
