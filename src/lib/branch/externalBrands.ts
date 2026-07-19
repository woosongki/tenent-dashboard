// 상권분석 [storeId] — 리테일 지도 기반 외부 체인 유치 후보.
//
// 빈(약한) 카테고리를 채울 브랜드를 '내부(이랜드 보유) 브랜드'가 아니라 외부 시장에서 찾는다.
// 근거: 리테일 지도(chains.ts)의 외부 체인 중 점포 반경 내에 실제 매장이 있다 =
//       그 상권에서 해당 업태 수요가 검증됨 → 유치 검토 후보로 우선순위가 높다.
//
// 좌표 데이터(chains.ts, ~1.1MB)는 서버에서만 동적 import → 초기 번들에서 분리.

import type { RetailCategory } from "./categoryGap";

interface RecruitChain { key: string; label: string; cat: RetailCategory; }

// 리테일 지도 체인 중 '유치 가능한 외부 시장 브랜드'만 선별한다.
//  · 백화점·대형마트(롯데/현대/신세계/AK/갤러리아/이마트 등)는 경쟁 앵커이므로 제외.
//  · 이랜드 보유 브랜드(스파오/미쏘/모던하우스)도 '외부 시장' 취지에 따라 제외.
const RECRUIT_CHAINS: RecruitChain[] = [
  { key: "daiso",        label: "다이소",     cat: "잡화" },
  { key: "oliveyoung",   label: "올리브영",   cat: "잡화" },
  { key: "artbox",       label: "아트박스",   cat: "잡화" },
  { key: "abcmart",      label: "ABC마트",    cat: "잡화" },
  { key: "uniqlo",       label: "유니클로",   cat: "캐주얼" },
  { key: "eightseconds", label: "에잇세컨즈", cat: "캐주얼" },
  { key: "muji",         label: "무인양품",   cat: "라이프스타일" },
  { key: "nitori",       label: "니토리",     cat: "라이프스타일" },
  { key: "hanssem",      label: "한샘",       cat: "라이프스타일" },
  { key: "livart",       label: "현대리바트", cat: "라이프스타일" },
  { key: "iloom",        label: "일룸",       cat: "라이프스타일" },
];

export interface NearbyChain {
  key: string;
  label: string;
  cat: RetailCategory;
  count: number;      // 반경 내 매장 수
  nearestKm: number;  // 가장 가까운 매장 거리(km)
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 점포 반경 내 외부 체인(유치 후보)을 체인별로 집계.
 * @param lat 점포 위도
 * @param lng 점포 경도
 * @param radiusKm 반경(기본 3km)
 * @returns 가까운 순 → 매장 많은 순 정렬된 인근 외부 체인 목록
 */
export async function getNearbyExternalChains(
  lat: number,
  lng: number,
  radiusKm = 3,
): Promise<NearbyChain[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const { CHAINS } = await import("@/data/chains");
  const out: NearbyChain[] = [];

  for (const rc of RECRUIT_CHAINS) {
    const stores = CHAINS[rc.key] ?? [];
    let count = 0;
    let nearest = Infinity;
    for (const s of stores) {
      const d = haversineKm(lat, lng, s.lat, s.lng);
      if (d <= radiusKm) {
        count++;
        if (d < nearest) nearest = d;
      }
    }
    if (count > 0) {
      out.push({ ...rc, count, nearestKm: Math.round(nearest * 10) / 10 });
    }
  }

  out.sort((a, b) => a.nearestKm - b.nearestKm || b.count - a.count);
  return out;
}
