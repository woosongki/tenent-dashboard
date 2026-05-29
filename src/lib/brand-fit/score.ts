// 브랜드 적합도 점수 산출 로직 (룰베이스, v2 — 촘촘한 연속값 + 실데이터 가중)
// PRD 가중치: 상권/고객층 35% / 앵커·동선 30% / 브랜드 성격 20% / 시너지 15%
//
// v1 → v2 개선:
//   - 모든 sub-score를 0-100 연속값으로 (이전엔 100/60/40 stepped)
//   - 빈 축은 평균으로 채우지 않고 가중치 재정규화로 제외
//   - 카테고리 매칭에 store-categories.json의 비중 % 직접 활용
//   - 앵커 매칭 정교화 (정확/부분 일치 + 매칭 개수 보너스)
//   - 타이브레이커: 매장 규모(브랜드 수) + 매출 잠재력

import { ELAND_STORES, type ElandStore } from "@/data/homeplus";
import {
  ELAND_META,
  getMeta,
  isMetaEmpty,
  type StoreMeta,
  type AgeBand,
  type Gender,
  type FamilyRatio,
  type PriceBand,
  type SpaceSize,
} from "@/data/eland-meta";
import storeCategoriesData from "@/data/store-categories.json";
import storeBrandsData from "@/data/store-brands.json";
import storeSalesData from "@/data/store-sales.json";
import storeAreasData from "@/data/store-areas.json";
import tradeAreaData from "@/data/trade-area.json";

// ── 사용자 입력 (브랜드 체크리스트) ──
export type Stay = "목적형" | "체험형" | "체류형";
export type OperationType = "상시매장" | "팝업(단기)" | "시즌형";
export type AvoidStrength = "강함" | "보통" | "약함";

export interface BrandInput {
  primary_age:    AgeBand[];
  primary_gender: Gender | null;
  family_ratio:   FamilyRatio | null;
  stay_type:      Stay | null;
  category:       string | null;
  price_band:     PriceBand | null;
  required_space: SpaceSize | null;
  operation_type: OperationType | null;
  preferred_anchors: string[];
  avoid_strength:    AvoidStrength;
}

const WEIGHTS = {
  trade_area: 0.35,
  anchors:    0.30,
  character:  0.20,
  synergy:    0.15,
} as const;

export interface AxisScores {
  trade_area: number;
  anchors:    number;
  character:  number;
  synergy:    number;
}

export interface FitScore {
  store: ElandStore;
  meta:  StoreMeta;
  total: number;
  axes:  AxisScores;
  hasData: boolean;
}

// ── 데이터 인덱스 (storeId → 통계) ──
type StoreCatRow = { storeId: number; total: number; ratios: Record<string, number> };
type StoreBrandRow = { storeId: number; brandCount: number; totalSales: number };
type StoreSalesRow = { storeId: number | null; avgPricePerCustomer: number };
type StoreAreaRow = { storeId: number; totalAreaPyeong: number; floorCount: number; maxFloorPyeong: number };
type TradeAreaRow = { storeId: number; sizeScore: number; regionTier: string; commercialDensity: number; foodPct: number; retailPct: number; leisurePct: number };

const categoriesIdx = new Map<number, StoreCatRow>();
(storeCategoriesData.stores as StoreCatRow[]).forEach((s) => categoriesIdx.set(s.storeId, s));

const brandsIdx = new Map<number, StoreBrandRow>();
(storeBrandsData.stores as StoreBrandRow[]).forEach((s) => brandsIdx.set(s.storeId, s));

const salesIdx = new Map<number, StoreSalesRow>();
(storeSalesData.stores as StoreSalesRow[]).forEach((s) => {
  if (s.storeId !== null) salesIdx.set(s.storeId, s);
});

// 41점 매장 규모 정규화 기준 (브랜드 수 분포)
const allBrandCounts = [...brandsIdx.values()].map((s) => s.brandCount);
const MAX_BRAND_COUNT = Math.max(...allBrandCounts);
const MIN_BRAND_COUNT = Math.min(...allBrandCounts);

// 매장 규모: 실제 전용면적(평) 기반 — 브랜드 수보다 정밀한 연속 신호
const areaIdx = new Map<number, StoreAreaRow>();
(storeAreasData.stores as StoreAreaRow[]).forEach((s) => areaIdx.set(s.storeId, s));
const allAreas = [...areaIdx.values()].map((s) => s.totalAreaPyeong);
const MAX_AREA = allAreas.length ? Math.max(...allAreas) : 0;
const MIN_AREA = allAreas.length ? Math.min(...allAreas) : 0;

// 상권 규모/유동인구: 권역 + 실측 상가밀도(소상공인 상가업소 반경 500m) 기반 외부 객관 신호
const tradeAreaIdx = new Map<number, TradeAreaRow>();
(tradeAreaData.stores as TradeAreaRow[]).forEach((s) => tradeAreaIdx.set(s.storeId, s));

// 상권 업종 믹스 정규화 기준 (상권 성격·체류 성격 산출용)
const _taVals = [...tradeAreaIdx.values()];
const _foodArr = _taVals.map((t) => t.foodPct);
const _retailArr = _taVals.map((t) => t.retailPct);
const _lingerArr = _taVals.map((t) => t.foodPct + t.leisurePct);
const _experienceArr = _taVals.map((t) => t.leisurePct + t.foodPct * 0.5);
function normIn(v: number, arr: number[]): number {
  if (!arr.length) return 0.5;
  const mn = Math.min(...arr), mx = Math.max(...arr);
  return mx > mn ? (v - mn) / (mx - mn) : 0.5;
}

// 가격대 → 대표 객단가(원) — store-sales 실객단가와 거리 매칭용 (priceBandRules 중앙값)
const PRICE_BAND_REP: Record<PriceBand, number> = {
  "초저가": 35000, "중저가": 75000, "중가": 150000, "중고가": 250000, "고가": 400000,
};

// 음식형 카테고리 판별 (상권 성격 매칭 시 음식 vs 소매 분기)
function isFoodCategory(cat: string): boolean {
  return /F&B|음식|식음료|카페|디저트|외식/i.test(cat);
}

// ─────────────────────────────────────────────────────────────
// 카테고리 키워드 매핑 (사용자 입력 → ERP 카테고리)
// store-categories.json의 컬럼명과 사용자 입력값을 정규화
const CATEGORY_ALIAS: Record<string, string[]> = {
  "패션":     ["여성의류", "캐주얼", "영캐주얼", "남성의류"], // 의류 전반
  "리빙":     ["라이프스타일", "하이퍼"],
  "라이프스타일": ["라이프스타일"],
  "잡화":     ["잡화"],
  "키즈":     ["아동의류"],
  "아동":     ["아동의류"],
  "뷰티":     ["여성의류"], // 화장품은 별도 카테고리 없음, 여성의류와 연관
  "F&B":      ["F&B"],
  "음식":     ["F&B"],
  "식음료":   ["F&B"],
  "헬스·웰니스": ["스포츠"],
  "헬스":     ["스포츠"],
  "스포츠":   ["스포츠"],
  "캐주얼":   ["캐주얼"],
  "영캐주얼": ["영캐주얼"],
  "여성":     ["여성의류"],
  "남성":     ["남성의류"],
};

function resolveCategoryKeys(userCategory: string): string[] {
  const lower = userCategory.toLowerCase();
  // 1) 직접 매핑
  for (const [k, v] of Object.entries(CATEGORY_ALIAS)) {
    if (k.toLowerCase() === lower) return v;
  }
  // 2) 부분 매칭 (사용자가 일부만 입력해도 alias 찾기)
  for (const [k, v] of Object.entries(CATEGORY_ALIAS)) {
    if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) return v;
  }
  return [userCategory]; // fallback
}

// 가격대 거리 (인접 가격대는 부분 점수)
const PRICE_ORDER: PriceBand[] = ["초저가", "중저가", "중가", "중고가", "고가"];
function priceDistance(a: PriceBand, b: PriceBand): number {
  return Math.abs(PRICE_ORDER.indexOf(a) - PRICE_ORDER.indexOf(b));
}

// ─────────────────────────────────────────────────────────────
// 평가축 1. 상권/고객층 (연령·성별·가족비)
// 모든 점포가 "여성 중심"이라 성별은 변별력 X → 가중치 낮춤
function scoreTradeArea(b: BrandInput, m: StoreMeta): number | null {
  const subs: { score: number; weight: number }[] = [];

  // 연령: 사용자 선호 연령이 점포 주요 연령에 얼마나 포함되는지 + 위치 가중
  if (b.primary_age.length && m.trade_area.primary_age.length) {
    // 점포의 첫 번째 연령대 = 주요, 두 번째 = 보조 (가중치 1.0 / 0.5)
    const ageWeights: Record<string, number> = {};
    m.trade_area.primary_age.forEach((a, i) => { ageWeights[a] = i === 0 ? 1.0 : 0.5; });
    const totalSum = b.primary_age.reduce((s, a) => s + (ageWeights[a] ?? 0), 0);
    const maxPossible = b.primary_age.length; // 모두 주요 연령에 매칭됐을 때
    const score = (totalSum / maxPossible) * 100;
    subs.push({ score, weight: 2.0 });
  }

  // 성별: 모든 점포가 "여성 중심"이라 변별력 미미 → 낮은 가중치
  if (b.primary_gender && m.trade_area.primary_gender) {
    let score = 50;
    if (b.primary_gender === m.trade_area.primary_gender) score = 95;
    else if (b.primary_gender === "균형" || m.trade_area.primary_gender === "균형") score = 65;
    else score = 25;
    subs.push({ score, weight: 0.5 });
  }

  // 가족 비율
  if (b.family_ratio && m.trade_area.family_ratio) {
    let score = 50;
    if (b.family_ratio === m.trade_area.family_ratio) score = 100;
    else if (b.family_ratio === "둘 다" || m.trade_area.family_ratio === "둘 다") score = 75;
    else score = 35;
    subs.push({ score, weight: 1.5 });
  }

  // 상권 규모/유동인구: 권역 + 실측 상가밀도 (브랜드 입력과 무관하게 항상 존재 → 지방 소형 vs 수도권 대형 차등)
  const ta = tradeAreaIdx.get(m.store_id);
  if (ta) {
    subs.push({ score: ta.sizeScore, weight: 2.0 });

    // 상권 성격 적합: 브랜드 업태(음식형/소매형) ↔ 주변 상권 업종 믹스
    if (b.category) {
      const n = isFoodCategory(b.category)
        ? normIn(ta.foodPct, _foodArr)
        : normIn(ta.retailPct, _retailArr);
      subs.push({ score: 40 + n * 60, weight: 1.0 });
    }

    // 체류 성격: 방문 행태 ↔ 상권 체류성(음식+여가) / 목적성(소매)
    if (b.stay_type) {
      let n: number;
      if (b.stay_type === "체류형") n = normIn(ta.foodPct + ta.leisurePct, _lingerArr);
      else if (b.stay_type === "체험형") n = normIn(ta.leisurePct + ta.foodPct * 0.5, _experienceArr);
      else n = normIn(ta.retailPct, _retailArr); // 목적형
      subs.push({ score: 40 + n * 60, weight: 1.0 });
    }
  }

  if (subs.length === 0) return null;
  const totalWeight = subs.reduce((s, x) => s + x.weight, 0);
  return subs.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight;
}

// 평가축 2. 인접 앵커 매칭
function scoreAnchors(b: BrandInput, m: StoreMeta): number | null {
  if (b.preferred_anchors.length === 0) return null;
  if (m.anchors.length === 0) return 10;

  const scores: number[] = b.preferred_anchors.map((p) => {
    const lower = p.toLowerCase();
    if (m.anchors.some((a) => a.toLowerCase() === lower)) return 100;
    if (m.anchors.some((a) => a.toLowerCase().includes(lower))) return 75;
    if (m.anchors.some((a) => lower.includes(a.toLowerCase()))) return 60;
    return 0;
  });

  const avg = scores.reduce((a, c) => a + c, 0) / scores.length;
  const matchedCount = scores.filter((s) => s > 0).length;
  // 매칭 개수 보너스
  const bonus = matchedCount >= 3 ? 15 : matchedCount === 2 ? 8 : 0;
  return Math.min(100, avg + bonus);
}

// 평가축 3. 브랜드 성격 (카테고리·가격·평형)
// 카테고리는 store-categories.json의 비중 % 직접 활용
function scoreCharacter(b: BrandInput, m: StoreMeta): number | null {
  const subs: { score: number; weight: number }[] = [];

  // 카테고리: 비중 % 기반 연속 점수
  if (b.category) {
    const catRow = categoriesIdx.get(m.store_id);
    if (catRow) {
      const resolvedKeys = resolveCategoryKeys(b.category);
      // 매칭되는 카테고리 비중 합
      let pctSum = 0;
      let hits = 0;
      for (const key of resolvedKeys) {
        // 정확 매칭 우선
        if (catRow.ratios[key] !== undefined) {
          pctSum += catRow.ratios[key];
          hits++;
        }
      }
      // 비중 → 점수: 30%+ = 95, 20% = 85, 10% = 65, 5% = 40, 0% = 15
      let score: number;
      if (hits === 0) score = 15;
      else if (pctSum >= 30) score = 95;
      else if (pctSum >= 20) score = 80;
      else if (pctSum >= 10) score = 60;
      else if (pctSum >= 5) score = 40;
      else score = 25;
      subs.push({ score, weight: 2.0 });
    }
  }

  // 가격대: 점포 실제 객단가(store-sales)와 거리 매칭 — 41점 모두 다른 객단가라 촘촘한 차등
  //         실객단가 데이터 없으면 기존 5단계 밴드 거리로 폴백
  if (b.price_band) {
    const sales = salesIdx.get(m.store_id);
    if (sales && sales.avgPricePerCustomer > 0) {
      const rep = PRICE_BAND_REP[b.price_band];
      const ratio = Math.abs(rep - sales.avgPricePerCustomer) / rep; // 상대 거리
      const score = Math.max(10, Math.min(100, 100 - ratio * 110));
      subs.push({ score, weight: 1.0 });
    } else if (m.tenant_mix.price_band.length) {
      const distances = m.tenant_mix.price_band.map((p) => priceDistance(b.price_band!, p));
      const minDist = Math.min(...distances);
      const score = minDist === 0 ? 100 : minDist === 1 ? 70 : minDist === 2 ? 40 : 15;
      subs.push({ score, weight: 1.0 });
    }
  }

  // 필요 평형 (공실 데이터 미입력이라 사실상 비활성)
  if (b.required_space && m.available_space.length) {
    subs.push({ score: m.available_space.includes(b.required_space) ? 100 : 20, weight: 1.0 });
  }

  if (subs.length === 0) return null;
  const totalWeight = subs.reduce((s, x) => s + x.weight, 0);
  return subs.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight;
}

// 평가축 4. 시너지 (운영형태 + 카니발 회피 + 매장 규모 가산)
function scoreSynergy(b: BrandInput, m: StoreMeta): number | null {
  const subs: { score: number; weight: number }[] = [];

  // 팝업 친화도
  if (b.operation_type && m.popup_friendly !== null) {
    let score = 50;
    if (b.operation_type === "상시매장") score = 90;
    else if (m.popup_friendly) score = 95;
    else score = 30;
    subs.push({ score, weight: 1.0 });
  }

  // 카니발 회피 (카테고리 겹침 감점)
  if (b.category) {
    const catRow = categoriesIdx.get(m.store_id);
    if (catRow) {
      const resolvedKeys = resolveCategoryKeys(b.category);
      let pctSum = 0;
      for (const key of resolvedKeys) {
        if (catRow.ratios[key] !== undefined) pctSum += catRow.ratios[key];
      }
      // 겹침 정도 × 회피 강도
      let score = 100;
      if (pctSum >= 20) {
        // 강한 겹침
        score = b.avoid_strength === "강함" ? 15 : b.avoid_strength === "보통" ? 50 : 80;
      } else if (pctSum >= 10) {
        // 중간 겹침
        score = b.avoid_strength === "강함" ? 40 : b.avoid_strength === "보통" ? 70 : 90;
      } else if (pctSum >= 5) {
        // 약한 겹침
        score = b.avoid_strength === "강함" ? 65 : b.avoid_strength === "보통" ? 85 : 95;
      }
      subs.push({ score, weight: 1.5 });
    }
  }

  // 매장 규모 가산 (전용면적 = 집객력·노출 잠재력)
  // 실제 전용면적(평)을 1순위로, 미입력 시 브랜드 수로 폴백
  const areaRow = areaIdx.get(m.store_id);
  if (areaRow && MAX_AREA > MIN_AREA) {
    const normalized = (areaRow.totalAreaPyeong - MIN_AREA) / (MAX_AREA - MIN_AREA);
    // 0~1 → 40~95 (큰 매장은 95에 가깝게)
    const score = 40 + normalized * 55;
    subs.push({ score, weight: 1.0 });
  } else {
    const brandRow = brandsIdx.get(m.store_id);
    if (brandRow) {
      const range = MAX_BRAND_COUNT - MIN_BRAND_COUNT;
      const normalized = range > 0 ? (brandRow.brandCount - MIN_BRAND_COUNT) / range : 0.5;
      const score = 40 + normalized * 55;
      subs.push({ score, weight: 1.0 });
    }
  }

  if (subs.length === 0) return null;
  const totalWeight = subs.reduce((s, x) => s + x.weight, 0);
  return subs.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight;
}

// ─────────────────────────────────────────────────────────────
function scoreOne(b: BrandInput, store: ElandStore, meta: StoreMeta): FitScore {
  const trade  = scoreTradeArea(b, meta);
  const anchor = scoreAnchors(b, meta);
  const charac = scoreCharacter(b, meta);
  const syner  = scoreSynergy(b, meta);

  // 빈 축은 가중치 재정규화 (평균 채우기 X)
  const raw = { trade_area: trade, anchors: anchor, character: charac, synergy: syner };
  const validKeys = (Object.keys(raw) as (keyof AxisScores)[]).filter((k) => raw[k] !== null);

  if (validKeys.length === 0) {
    return {
      store, meta,
      total: 0,
      axes: { trade_area: 0, anchors: 0, character: 0, synergy: 0 },
      hasData: !isMetaEmpty(meta),
    };
  }

  // 평가 가능한 축의 가중치 합
  const usedWeightSum = validKeys.reduce((s, k) => s + WEIGHTS[k], 0);
  // 재정규화된 가중치로 점수 계산
  let total = 0;
  for (const k of validKeys) {
    total += (raw[k] as number) * (WEIGHTS[k] / usedWeightSum);
  }

  // 표시용 axes (빈 축은 0 표시, 시각화에서 회색 처리)
  const axes: AxisScores = {
    trade_area: trade ?? 0,
    anchors:    anchor ?? 0,
    character:  charac ?? 0,
    synergy:    syner ?? 0,
  };

  return {
    store, meta,
    total: Math.round(total * 10) / 10, // 소수점 1자리 (촘촘한 차등)
    axes,
    hasData: !isMetaEmpty(meta),
  };
}

/** 41개점 전체 평가 후 상위 N개 반환 (타이브레이커: 매장 규모) */
export function rankStores(b: BrandInput, topN = 3): FitScore[] {
  const all = ELAND_STORES.map((s) => {
    const meta = getMeta(s.id) ?? {
      store_id: s.id,
      trade_area: { primary_age: [], primary_gender: null, family_ratio: null },
      anchors: [],
      tenant_mix: { categories: [], price_band: [] },
      available_space: [],
      popup_friendly: null,
    };
    return scoreOne(b, s, meta);
  });
  return all.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    // 타이브레이커 1: 매장 규모 (전용면적)
    const aArea = areaIdx.get(a.store.id)?.totalAreaPyeong ?? 0;
    const bArea = areaIdx.get(b.store.id)?.totalAreaPyeong ?? 0;
    if (bArea !== aArea) return bArea - aArea;
    // 타이브레이커 2: 브랜드 수
    const aCount = brandsIdx.get(a.store.id)?.brandCount ?? 0;
    const bCount = brandsIdx.get(b.store.id)?.brandCount ?? 0;
    return bCount - aCount;
  }).slice(0, topN);
}
