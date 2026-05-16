// 아트박스 전국 매장 위치 데이터
// 수집: Kakao Local API (scripts/fetch-artbox-stores.mjs 실행으로 갱신)
// 마지막 갱신: (아직 미수집 — 스크립트 실행 후 자동 채워짐)

export interface ChainStore {
  id: string;          // kakao place id
  name: string;        // 매장명
  addr: string;        // 도로명주소 (없으면 지번주소)
  lat: number;
  lng: number;
}

export const ARTBOX_STORES: ChainStore[] = [];
