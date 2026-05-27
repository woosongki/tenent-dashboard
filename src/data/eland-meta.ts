// 이랜드 41개점 정성 메타데이터 (브랜드 적합도 진단용)
// store_id는 src/data/homeplus.ts 의 ELAND_STORES.id 와 1:1 매칭
//
// 채우는 방법:
//   각 점포 객체의 null/빈 배열을 단이님이 알고 있는 값으로 교체.
//   미입력 필드는 점수 산출 시 "데이터 없음"으로 처리되어 해당 평가축
//   가중치가 자동 감소됨. 결과 카드에 "데이터 보완 필요" 라벨 표시.

export type AgeBand = "10대" | "20대" | "30대" | "40대" | "50대" | "60대+";
export type Gender = "여성 중심" | "남성 중심" | "균형";
export type FamilyRatio = "가족 중심" | "개인 중심" | "둘 다";
export type PriceBand = "초저가" | "중저가" | "중가" | "중고가" | "고가";
export type SpaceSize = "~30평" | "30~50평" | "50~100평" | "100평+";

export interface StoreMeta {
  store_id: number;
  trade_area: {
    primary_age: AgeBand[];           // 빈 배열 = 미입력
    primary_gender: Gender | null;    // null = 미입력
    family_ratio: FamilyRatio | null;
  };
  anchors: string[];                  // 입점 중인 앵커 매장 (자유 텍스트)
  tenant_mix: {
    categories: string[];             // 강세 카테고리 (자유 텍스트)
    price_band: PriceBand[];          // 강세 가격대
  };
  available_space: SpaceSize[];       // 현재 입점 가능한 공간 크기
  popup_friendly: boolean | null;     // 팝업 운영 친화도
}

/** 빈 메타 생성 헬퍼 */
function empty(id: number): StoreMeta {
  return {
    store_id: id,
    trade_area: { primary_age: [], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: [], price_band: [] },
    available_space: [],
    popup_friendly: null,
  };
}

// 41개점 정성 데이터 — primary_age는 점포별 ERP 구매고객 데이터로 자동 채움 (store-demographics.json)
// 나머지 슬롯(gender, family_ratio, anchors, categories, price_band, space, popup)은 단이님이 입력 예정
export const ELAND_META: StoreMeta[] = [
  {
    store_id: 1,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 2,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["아동의류","F&B"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 3,
    trade_area: { primary_age: ["50대","40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["캐주얼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 4,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["여성의류","영캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 5,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["아동의류","캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 6,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 7,
    trade_area: { primary_age: ["40대","60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼","F&B"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 8,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["스포츠","F&B"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 9,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["여성의류","잡화"], price_band: ["고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 10,
    trade_area: { primary_age: ["60대+","40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["F&B","하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 11,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 12,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["아동의류","남성의류"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 13,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["F&B","라이프스타일","캐주얼","아동의류"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 14,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["캐주얼","여성의류","영캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 15,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["F&B","라이프스타일"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 16,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["캐주얼","아동의류"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 17,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 18,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["F&B"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 19,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 20,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 21,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼","스포츠"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 22,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["스포츠","캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 23,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: [], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 24,
    trade_area: { primary_age: ["40대","50대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼","스포츠"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 25,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼","라이프스타일"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 26,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["잡화","아동의류","캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 27,
    trade_area: { primary_age: ["60대+","40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["영캐주얼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 28,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: [], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 29,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 30,
    trade_area: { primary_age: ["40대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["아동의류","스포츠","남성의류"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 31,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 32,
    trade_area: { primary_age: ["60대+","50대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["남성의류"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 33,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["스포츠","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 34,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 35,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["여성의류","스포츠","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 36,
    trade_area: { primary_age: ["50대"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: [], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 37,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["스포츠"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 38,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["남성의류","여성의류","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 39,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["여성의류","잡화"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 40,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼","잡화"], price_band: ["중가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
  {
    store_id: 41,
    trade_area: { primary_age: ["60대+"] as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: ["하이퍼"], price_band: ["중고가"] as PriceBand[] },
    available_space: [],
    popup_friendly: null,
  },
];

/** store_id로 메타 조회 */
export function getMeta(storeId: number): StoreMeta | undefined {
  return ELAND_META.find((m) => m.store_id === storeId);
}

/** 메타가 비어있는지 검사 (모든 정성 필드가 미입력) */
export function isMetaEmpty(m: StoreMeta): boolean {
  return (
    m.trade_area.primary_age.length === 0 &&
    m.trade_area.primary_gender === null &&
    m.trade_area.family_ratio === null &&
    m.anchors.length === 0 &&
    m.tenant_mix.categories.length === 0 &&
    m.tenant_mix.price_band.length === 0 &&
    m.available_space.length === 0 &&
    m.popup_friendly === null
  );
}
