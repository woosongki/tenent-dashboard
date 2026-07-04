// 상권분석 [storeId] — 빈 카테고리 판정 + 제안 브랜드(피어 갭).
//
// 데이터(정적, build-store-*.mjs 생성 · 서버 전용):
//   store-categories.json : 점포별 10개 카테고리 매출·비중(ratio %)
//   store-brands.json     : 점포별 입점 브랜드(brand+sales)
//   trade-area _index     : 점포별 상권유형(tradeAreaType) → 같은 유형 = cohort
// 조인: storeName (세 소스 모두 41/41 일치 확인).

import { getTradeAreaIndex } from "@/lib/tradeArea";
import storeCategoriesRaw from "@/data/store-categories.json";
import storeBrandsRaw from "@/data/store-brands.json";
import { isOthersBrand } from "@/lib/sales/labels";

export const RETAIL_CATEGORIES = [
  "캐주얼", "잡화", "영캐주얼", "남성의류", "아동의류",
  "여성의류", "스포츠", "하이퍼", "F&B", "라이프스타일",
] as const;
export type RetailCategory = (typeof RETAIL_CATEGORIES)[number];

interface CatStore { storeName: string; ratios: Record<string, number>; }
interface BrandStore { storeName: string; brands?: { brand: string; sales: number }[]; }

const catByName = new Map<string, Record<string, number>>(
  (storeCategoriesRaw as { stores: CatStore[] }).stores.map((s) => [s.storeName, s.ratios]),
);
const brandsByName = new Map<string, { brand: string; sales: number }[]>(
  (storeBrandsRaw as { stores: BrandStore[] }).stores.map((s) => [s.storeName, s.brands ?? []]),
);

export interface WeakCategory { cat: RetailCategory; myPct: number; cohortAvg: number; gap: number; }
export interface PeerGapBrand { brand: string; peerCount: number; avgSales: number; }
export interface CategoryGap {
  tradeAreaType: string;
  cohortSize: number;   // 자기 포함 같은 유형 점포 수
  weak: WeakCategory[];  // 빈/약한 카테고리 (gap 큰 순, 최대 3)
  peerGap: PeerGapBrand[]; // 피어 갭 브랜드 (최대 8)
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// 브랜드명 정규화 — store-brands는 "모던하우스공통(MODERN HOUSE"처럼 괄호가 잘림.
// 첫 괄호 이후 제거 + 공백 제거 + 소문자.
function normalizeBrand(b: string): string {
  return b.replace(/\(.*$/, "").replace(/\s+/g, "").toLowerCase();
}

/**
 * 점포의 카테고리 갭 + 피어 갭 브랜드.
 * @param storeId 라우트 슬러그 id (trade-area 인덱스 키)
 * @param storeName store-categories/brands 조인 키
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

  // ── 피어 갭 브랜드: 같은 유형 2곳 이상 입점 + 고매출인데 우리엔 없는 브랜드 ──
  const myBrandKeys = new Set((brandsByName.get(storeName) ?? []).map((b) => normalizeBrand(b.brand)));
  const agg = new Map<string, { brand: string; peerCount: number; salesSum: number }>();
  for (const pn of peerNames) {
    for (const b of brandsByName.get(pn) ?? []) {
      const key = normalizeBrand(b.brand);
      if (!key || myBrandKeys.has(key)) continue;
      // 매출분석 '그외' 분리 브랜드(엠페스트·코코몽키즈랜드 등)는 제안 대상에서 제외 —
      // 매출이 커도 입점 제안할 컨텐츠가 아님.
      if (isOthersBrand(b.brand)) continue;
      const e = agg.get(key) ?? { brand: b.brand, peerCount: 0, salesSum: 0 };
      e.peerCount++;
      e.salesSum += b.sales;
      agg.set(key, e);
    }
  }
  const peerGap: PeerGapBrand[] = [...agg.values()]
    .filter((e) => e.peerCount >= 2)
    .map((e) => ({ brand: e.brand, peerCount: e.peerCount, avgSales: Math.round(e.salesSum / e.peerCount) }))
    // 고매출 앵커 우선: peer 평균매출 내림차순, 동률이면 입점 빈도.
    .sort((a, b) => b.avgSales - a.avgSales || b.peerCount - a.peerCount)
    .slice(0, 8);

  return { tradeAreaType: me.tradeAreaType, cohortSize: cohort.length, weak: weak.slice(0, 3), peerGap };
}
