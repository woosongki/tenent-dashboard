// 브랜드 적합도 — 클라이언트 안전 타입·상수 (무거운 데이터 import 없음).
// 점수 계산(score.ts)은 서버 전용이며 큰 JSON을 클라 번들로 끌어오지 않도록 분리한다.

import type { ElandStore } from "@/data/homeplus";
import type { StoreMeta, AgeBand, Gender, FamilyRatio, PriceBand, SpaceSize } from "@/data/eland-meta";

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

export const WEIGHTS = {
  trade_area: 0.50,
  anchors:    0.20,
  character:  0.20,
  synergy:    0.10,
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
