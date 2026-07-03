// 리테일 지도 레이어 레지스트리 — 사이드바 하위 메뉴와 라벨의 단일 소스.
//
// 좌표 데이터(src/data/<chain>.ts)는 무겁고 지도 페이지에서만 필요하므로 여기서
// import 하지 않는다. 대신 점포 수는 자동 생성된 숫자 맵(retail-layer-counts.ts)에서
// 읽어 라벨에 합친다 → 사이드바 번들에 좌표가 딸려오지 않는다.
//
// 점포 수 갱신: 체인 데이터 파일 수정 후 `node scripts/gen-retail-layers.mjs` 실행.
// (retail-layers.test.ts 가 생성 누락을 CI에서 잡는다.)

import { RETAIL_LAYER_COUNTS } from "./retail-layer-counts";

export type RetailGroup = "백화점" | "브랜드" | "기타" | "마트";

export interface RetailLayer {
  /** URL ?layer= 값 및 counts 키 */
  layer: string;
  /** 라벨 접두어(점포 수 제외) */
  name: string;
  group: RetailGroup;
  /** 지도 dot 색상 */
  dotColor: string;
  /** dot 모양 — 기본 사각, 올리브영만 원형 */
  shape?: "circle" | "square";
}

// 순서·색상·그룹은 디자인 결정값이라 손으로 관리(데이터에서 파생되지 않음).
// 점포 수만 자동 생성분과 병합된다.
export const RETAIL_LAYERS: RetailLayer[] = [
  // 백화점
  { layer: "lotte",       name: "롯데백화점",     group: "백화점", dotColor: "#a4133c" },
  { layer: "hyundai",     name: "현대백화점",     group: "백화점", dotColor: "#1d3557" },
  { layer: "shinsegae",   name: "신세계백화점",   group: "백화점", dotColor: "#495057" },
  { layer: "ak",          name: "AK백화점",       group: "백화점", dotColor: "#6f1d77" },
  { layer: "galleria",    name: "갤러리아",       group: "백화점", dotColor: "#2d5016" },
  // 브랜드
  { layer: "artbox",      name: "아트박스",       group: "브랜드", dotColor: "#f72585" },
  { layer: "abcmart",     name: "ABC마트",        group: "브랜드", dotColor: "#e63946" },
  { layer: "8seconds",    name: "에잇세컨즈",     group: "브랜드", dotColor: "#fbbf24" },
  { layer: "spao",        name: "스파오",         group: "브랜드", dotColor: "#0b3d91" },
  { layer: "mixxo",       name: "미쏘",           group: "브랜드", dotColor: "#e6007e" },
  { layer: "daiso",       name: "다이소",         group: "브랜드", dotColor: "#f9c74f" },
  { layer: "oliveyoung",  name: "올리브영",       group: "브랜드", dotColor: "#52b788", shape: "circle" },
  { layer: "modernhouse", name: "모던하우스",     group: "브랜드", dotColor: "#6a2c70" },
  { layer: "muji",        name: "무인양품",       group: "브랜드", dotColor: "#6f4e37" },
  { layer: "hanssem",     name: "한샘디자인파크", group: "브랜드", dotColor: "#1e5fa3" },
  { layer: "livart",      name: "현대리바트",     group: "브랜드", dotColor: "#ec4899" },
  { layer: "iloom",       name: "일룸",           group: "브랜드", dotColor: "#ca8a04" },
  { layer: "nitori",      name: "니토리",         group: "브랜드", dotColor: "#ea580c" },
  { layer: "uniqlo",      name: "유니클로",       group: "브랜드", dotColor: "#be123c" },
  // 기타 (체인 매장 + 그 외)
  { layer: "entersix",    name: "엔터식스",       group: "기타",   dotColor: "#ff6f3c" },
  { layer: "moda",        name: "모다아울렛",     group: "기타",   dotColor: "#00b4a0" },
  { layer: "savezone",    name: "세이브존",       group: "기타",   dotColor: "#95a847" },
  { layer: "lf",          name: "LF스퀘어",       group: "기타",   dotColor: "#a08260" },
  // 마트
  { layer: "emart",       name: "이마트",         group: "마트",   dotColor: "#ffc107" },
  { layer: "lottemart",   name: "롯데마트",       group: "마트",   dotColor: "#d62828" },
  { layer: "hanaromart",  name: "하나로마트",     group: "마트",   dotColor: "#2d6a4f" },
];

/** 레이어 점포 수 (자동 생성분 조회). 없으면 0. */
export function retailLayerCount(layer: string): number {
  return RETAIL_LAYER_COUNTS[layer] ?? 0;
}

/** "다이소 1,714점" 형태 라벨. 점포 수가 0/미상이면 접두어만. */
export function retailLayerLabel(l: RetailLayer): string {
  const n = retailLayerCount(l.layer);
  return n > 0 ? `${l.name} ${n.toLocaleString()}점` : l.name;
}
