// 리테일 지도 마커 아이콘 & tier 상수
// HomeplusMapClient에서 분리 (순수 상수/팩토리 — 컴포넌트 상태 없음)

import L from "leaflet";
import type { Tier } from "@/data/homeplus";

export const TIER_COLOR: Record<Tier, string> = {
  "동일상권": "#ef476f",
  "인접상권": "#ffb547",
  "근접권":   "#06d6a0",
  "별도상권": "#5a6378",
};

export const TIER_LABEL: Record<Tier, string> = {
  "동일상권": "동일 (≤1km)",
  "인접상권": "인접 (1~3km)",
  "근접권":   "근접 (3~5km)",
  "별도상권": "별도",
};

export const TIER_ORDER: Record<Tier, number> = {
  "동일상권": 0, "인접상권": 1, "근접권": 2, "별도상권": 3,
};

export const ALL_TIERS: Tier[] = ["동일상권", "인접상권", "근접권", "별도상권"];

// 다이아몬드 모양 이랜드 마커
export const elandIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#4cc9f0;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// 체인 매장 마커 (브랜드 컬러)
export const artboxIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;background:#f72585;border:1.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});
export const daisoIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;background:#f9c74f;border:1.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});
export const oliveyoungIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;background:#52b788;border:1.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// 백화점 — 사각형 + 글자 라벨 (앵커 매장이라 더 크게)
function makeDeptIcon(letter: string, bg: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;background:${bg};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,.4)">${letter}</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
export const lotteIcon     = makeDeptIcon("L", "#a4133c");  // 와인 레드
export const hyundaiIcon   = makeDeptIcon("H", "#1d3557");  // 다크 네이비
export const shinsegaeIcon = makeDeptIcon("S", "#495057");  // 다크 그레이
export const akIcon        = makeDeptIcon("AK","#6f1d77");  // AK 보라
export const galleriaIcon  = makeDeptIcon("G", "#2d5016");  // 갤러리아 다크그린

// 그 외 — 작은 사각 7px
function makeSmallSquareIcon(bg: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:8px;height:8px;background:${bg};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}
export const entersixIcon = makeSmallSquareIcon("#ff6f3c");
export const modaIcon     = makeSmallSquareIcon("#00b4a0");
export const savezoneIcon = makeSmallSquareIcon("#95a847");
export const lfIcon       = makeSmallSquareIcon("#a08260");
export const saturIcon    = makeSmallSquareIcon("#7c3aed"); // 보라 — 세터
export const modernhouseIcon = makeSmallSquareIcon("#6a2c70"); // 자줏빛 보라 — 모던하우스

// 마트 — 원형 10px (백화점보다 작게, 체인보다 약간 큼)
function makeCircleIcon(bg: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:11px;height:11px;background:${bg};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [11, 11],
    iconAnchor: [5.5, 5.5],
  });
}
export const emartIcon      = makeCircleIcon("#ffc107"); // 노랑
export const lottemartIcon  = makeCircleIcon("#d62828"); // 빨강
export const hanaromartIcon = makeCircleIcon("#2d6a4f"); // 농협 초록
