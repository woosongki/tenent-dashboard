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

// 41개 빈 정성 데이터 — store_id 1~41 (ELAND_STORES와 동일)
export const ELAND_META: StoreMeta[] = Array.from({ length: 41 }, (_, i) => empty(i + 1));

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
