"use client";

import { useEffect, useRef, useState } from "react";

// Kakao Maps SDK는 외부 글로벌이라 단순 any 타입으로 처리
// (공식 타입 패키지 @types/kakaomaps 가 v3 미지원이라 직접 선언)
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

interface Props {
  lat: number;
  lng: number;
  /** 매장명 (마커 인포 라벨) */
  label: string;
  /** 표시할 반경 미터 (상권 분석 반경) */
  radius?: number;
  /** 지도 높이 (CSS) */
  height?: string;
}

/**
 * 카카오 JS SDK 지도 컴포넌트 (Client Component).
 *
 * 사전조건: `NEXT_PUBLIC_KAKAO_MAP_KEY` 환경변수 (카카오 개발자콘솔 → 앱 키 → JavaScript 키)
 * 도메인 등록: 카카오 콘솔 → 플랫폼 → Web → 사이트 도메인에 localhost / vercel 도메인 추가
 *
 * 키가 없거나 SDK 로드 실패 시 placeholder fallback 으로 안내.
 */
export default function KakaoStoreMap({
  lat,
  lng,
  label,
  radius = 500,
  height = "320px",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 빌드 타임에 결정되는 값이라 초기 state로 그대로 사용 (effect 내 setState 회피)
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const [status, setStatus] = useState<"loading" | "ready" | "missing-key" | "error">(
    apiKey ? "loading" : "missing-key",
  );

  useEffect(() => {
    if (!apiKey) return;

    // 이미 로드되었는지 확인
    if (typeof window !== "undefined" && window.kakao && window.kakao.maps) {
      initMap();
      return;
    }

    // SDK 동적 로드
    const SCRIPT_ID = "kakao-maps-sdk";
    if (document.getElementById(SCRIPT_ID)) {
      // 이미 로딩 중. ready 이벤트 기다림
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => initMap());
      } else {
        setTimeout(initMap, 200);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.onload = () => {
      window.kakao.maps.load(initMap);
    };
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);

    function initMap() {
      if (!containerRef.current) return;
      try {
        const k = window.kakao;
        const center = new k.maps.LatLng(lat, lng);
        const map = new k.maps.Map(containerRef.current, {
          center,
          level: 4, // 1=가장 가까움 ~ 14
        });

        // 매장 마커
        new k.maps.Marker({ position: center, map });

        // 매장명 인포 오버레이
        new k.maps.CustomOverlay({
          map,
          position: center,
          yAnchor: 2.4,
          content: `<div style="background:#0f172a;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;">${label}</div>`,
        });

        // 반경 원 (상권 분석 반경 시각화)
        new k.maps.Circle({
          map,
          center,
          radius,
          strokeWeight: 1,
          strokeColor: "#0ea5e9",
          strokeOpacity: 0.6,
          strokeStyle: "shortdash",
          fillColor: "#0ea5e9",
          fillOpacity: 0.08,
        });

        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }
  }, [lat, lng, label, radius, apiKey]);

  if (status === "missing-key") {
    return (
      <div
        className="rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-[12px] text-slate-600 px-4">
          <p className="font-semibold">지도 키 미설정</p>
          <p className="mt-1 text-[11px] text-slate-500">
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">NEXT_PUBLIC_KAKAO_MAP_KEY</code>{" "}
            환경변수에 카카오 JavaScript 키를 설정하세요.
          </p>
          <p className="mt-2 font-mono text-[10px] text-slate-400 tabular-nums">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="rounded-lg overflow-hidden bg-rose-50 border border-rose-200 flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-[12px] text-rose-700">
          지도 로드 실패 — 도메인 등록 또는 키를 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
          <p className="text-[11px] text-slate-500">지도 로드 중…</p>
        </div>
      )}
    </div>
  );
}
