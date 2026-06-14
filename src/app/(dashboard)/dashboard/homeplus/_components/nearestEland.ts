// 체인 매장 → 최근접 이랜드 점포 거리 계산 (툴팁 표시용)
import { ELAND_STORES, type ElandStore } from "@/data/homeplus";

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const av = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(av), Math.sqrt(1 - av));
}

export interface NearestEland {
  store: ElandStore;
  distanceKm: number;
}

/** 좌표에서 가장 가까운 이랜드 점포 + 거리(km) 반환 */
export function nearestEland(lat: number, lng: number): NearestEland | null {
  let best: NearestEland | null = null;
  for (const e of ELAND_STORES) {
    const d = haversineKm(lat, lng, e.lat, e.lng);
    if (!best || d < best.distanceKm) best = { store: e, distanceKm: d };
  }
  return best;
}
