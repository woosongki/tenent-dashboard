"use client";

// 선택된 좌표로 지도를 부드럽게 이동시키는 헬퍼 컴포넌트.
// MapContainer 내부에 위치해야 useMap()이 동작함.

import { useEffect } from "react";
import { useMap } from "react-leaflet";

export type FlyTarget = { lat: number; lng: number; zoom?: number; key: string };

export default function FlyToTarget({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 13, {
      duration: 0.7,
      easeLinearity: 0.25,
    });
  }, [target, map]);
  return null;
}
