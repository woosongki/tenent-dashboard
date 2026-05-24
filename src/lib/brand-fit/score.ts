// 브랜드 적합도 점수 산출 로직 (룰베이스)
// PRD 가중치: 상권/고객층 35% / 앵커·동선 30% / 브랜드 성격 20% / 시너지 15%

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

// ── 사용자 입력 (브랜드 체크리스트) ──
export type Stay = "목적형" | "체험형" | "체류형";
export type OperationType = "상시매장" | "팝업(단기)" | "시즌형";
export type AvoidStrength = "강함" | "보통" | "약함";

export interface BrandInput {
  // 확보가능 (8개) — 빈 값/null 허용
  primary_age:    AgeBand[];
  primary_gender: Gender | null;
  family_ratio:   FamilyRatio | null;
  stay_type:      Stay | null;
  category:       string | null;
  price_band:     PriceBand | null;
  required_space: SpaceSize | null;
  operation_type: OperationType | null;
  // 반드시 입력 (2개)
  preferred_anchors: string[];        // 자유 태그 (예: "다이소", "애슐리")
  avoid_strength:    AvoidStrength;
}

// 4축 가중치
const WEIGHTS = {
  trade_area: 0.35,
  anchors:    0.30,
  character:  0.20,
  synergy:    0.15,
} as const;

export interface AxisScores {
  trade_area: number;  // 0~100 (또는 null: 평가 불가)
  anchors:    number;
  character:  number;
  synergy:    number;
}

export interface FitScore {
  store: ElandStore;
  meta:  StoreMeta;
  total: number;       // 0~100 (가중합)
  axes:  AxisScores;
  hasData: boolean;    // 정성 데이터가 일부라도 있는지
}

// ─────────────────────────────────────────────────────────────
// 평가축 1. 상권/고객층 매칭 (연령·성별·가족비율)
function scoreTradeArea(b: BrandInput, m: StoreMeta): number | null {
  const sub: number[] = [];

  // 연령 매칭 — 교집합 비율
  if (b.primary_age.length && m.trade_area.primary_age.length) {
    const overlap = b.primary_age.filter((a) => m.trade_area.primary_age.includes(a)).length;
    sub.push((overlap / b.primary_age.length) * 100);
  }
  // 성별 매칭
  if (b.primary_gender && m.trade_area.primary_gender) {
    if (b.primary_gender === m.trade_area.primary_gender) sub.push(100);
    else if (b.primary_gender === "균형" || m.trade_area.primary_gender === "균형") sub.push(60);
    else sub.push(20);
  }
  // 가족 비율 매칭
  if (b.family_ratio && m.trade_area.family_ratio) {
    if (b.family_ratio === m.trade_area.family_ratio) sub.push(100);
    else if (b.family_ratio === "둘 다" || m.trade_area.family_ratio === "둘 다") sub.push(70);
    else sub.push(30);
  }

  if (sub.length === 0) return null;  // 데이터 부족
  return sub.reduce((a, b) => a + b, 0) / sub.length;
}

// 평가축 2. 인접 앵커 매칭 (자유 태그)
function scoreAnchors(b: BrandInput, m: StoreMeta): number | null {
  if (b.preferred_anchors.length === 0) return null;
  if (m.anchors.length === 0) return 0;  // 지점 앵커 데이터 없음 = 매칭 불가
  // 부분 문자열 매칭 (case-insensitive)
  const matched = b.preferred_anchors.filter((p) =>
    m.anchors.some((a) => a.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(a.toLowerCase())),
  );
  // 매칭 비율 + 보너스 (다 매칭되면 100, 일부면 비례)
  const ratio = matched.length / b.preferred_anchors.length;
  return Math.min(100, ratio * 100 + (matched.length >= 2 ? 10 : 0));
}

// 평가축 3. 브랜드 성격 (카테고리·가격·평형)
function scoreCharacter(b: BrandInput, m: StoreMeta): number | null {
  const sub: number[] = [];

  // 카테고리 일치
  if (b.category && m.tenant_mix.categories.length) {
    const hit = m.tenant_mix.categories.some((c) =>
      c.toLowerCase().includes(b.category!.toLowerCase()) || b.category!.toLowerCase().includes(c.toLowerCase()),
    );
    sub.push(hit ? 100 : 30);
  }
  // 가격대 일치
  if (b.price_band && m.tenant_mix.price_band.length) {
    sub.push(m.tenant_mix.price_band.includes(b.price_band) ? 100 : 40);
  }
  // 필요 평형 vs 가용 공간
  if (b.required_space && m.available_space.length) {
    sub.push(m.available_space.includes(b.required_space) ? 100 : 20);
  }

  if (sub.length === 0) return null;
  return sub.reduce((a, b) => a + b, 0) / sub.length;
}

// 평가축 4. 시너지 (운영형태 + 카니발 회피)
function scoreSynergy(b: BrandInput, m: StoreMeta): number | null {
  const sub: number[] = [];

  // 팝업 친화도
  if (b.operation_type && m.popup_friendly !== null) {
    if (b.operation_type === "상시매장") sub.push(100);
    else if (m.popup_friendly) sub.push(100);
    else sub.push(30);
  }
  // 카니발 회피: 카테고리가 이미 강세면 회피 강도에 따라 감점
  if (b.category && m.tenant_mix.categories.length) {
    const overlap = m.tenant_mix.categories.some((c) =>
      c.toLowerCase().includes(b.category!.toLowerCase()) || b.category!.toLowerCase().includes(c.toLowerCase()),
    );
    if (overlap) {
      if (b.avoid_strength === "강함") sub.push(20);
      else if (b.avoid_strength === "보통") sub.push(60);
      else sub.push(90);  // 약함: 공존 OK
    } else {
      sub.push(100);  // 카테고리 겹침 없음 = 카니발 위험 낮음
    }
  }

  if (sub.length === 0) return null;
  return sub.reduce((a, b) => a + b, 0) / sub.length;
}

// ─────────────────────────────────────────────────────────────
/** 단일 지점에 대한 적합도 산출 */
function scoreOne(b: BrandInput, store: ElandStore, meta: StoreMeta): FitScore {
  const trade  = scoreTradeArea(b, meta);
  const anchor = scoreAnchors(b, meta);
  const charac = scoreCharacter(b, meta);
  const syner  = scoreSynergy(b, meta);

  // null 축은 평균으로 추정 (데이터 없을 때 무난한 기본값)
  // 모든 축이 null이면 전체 0점
  const valid = [trade, anchor, charac, syner].filter((v): v is number => v !== null);
  const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  const fillNull = (v: number | null) => v ?? avg;

  const axes: AxisScores = {
    trade_area: fillNull(trade),
    anchors:    fillNull(anchor),
    character:  fillNull(charac),
    synergy:    fillNull(syner),
  };

  const total =
    axes.trade_area * WEIGHTS.trade_area +
    axes.anchors    * WEIGHTS.anchors +
    axes.character  * WEIGHTS.character +
    axes.synergy    * WEIGHTS.synergy;

  return {
    store,
    meta,
    total: Math.round(total),
    axes,
    hasData: !isMetaEmpty(meta),
  };
}

/** 41개점 전체 평가 후 상위 N개 반환 */
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
  return all.sort((a, b) => b.total - a.total).slice(0, topN);
}
