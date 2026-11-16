"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const SCRIPT_ID = "kakao-maps-sdk";

/**
 * 카카오 JS SDK 지도 컴포넌트 (Client Component).
 *
 * 사전조건: `NEXT_PUBLIC_KAKAO_MAP_KEY` 환경변수 (카카오 개발자콘솔 → 앱 키 → JavaScript 키)
 * 도메인 등록: 카카오 콘솔 → 앱 설정 → 플랫폼 → Web → 사이트 도메인에 접속 주소를 그대로 추가.
 *   Vercel은 배포마다 고유 URL(lifestyle-xxxx.vercel.app)을 발급하는데 그건 등록이 불가능하다.
 *   고정 별칭(프로덕션/ git-main) 주소로 접속해야 한다.
 *
 * 실패 처리(2026-11 개선): 카카오는 401 본문에 사유를 준다
 * (`domain mismatched!` / `invalid appkey`). 예전엔 그 사유를 버리고 "로드 실패"만 띄워
 * 매번 수동 추적해야 했다 → 이제 사유를 조회해 화면·콘솔에 남기고, 실패한 script 태그를
 * 제거해 '다시 시도'로 복구할 수 있게 한다(새로고침 불필요).
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
  /** 카카오가 준 거절 사유 (없으면 null — 네트워크 차단 등 본문을 못 읽은 경우) */
  const [reason, setReason] = useState<string | null>(null);
  /** '다시 시도' 카운터 — 올리면 effect가 처음부터 다시 돈다 */
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    // 실패한 script 태그를 지우지 않으면 다음 시도가 "이미 로딩 중" 분기로 빠져
    // window.kakao 없이 초기화를 시도하다 또 실패한다(예전 고착 버그).
    document.getElementById(SCRIPT_ID)?.remove();
    setReason(null);
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;          // 언마운트 후 setState 방지
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sdkUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;

    /** 실패 사유를 카카오에서 직접 받아 화면·콘솔에 남긴다(조회 실패해도 진행). */
    async function fail(where: string) {
      if (cancelled) return;
      setStatus("error");
      let detail: string | null = null;
      try {
        // 카카오 401 응답엔 CORS 헤더가 없어 브라우저에서 본문을 못 읽는다 → 서버 경유로 사유 조회.
        const res = await fetch("/api/maps/kakao-diagnose", { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as { status: number | null; message: string };
          detail = j.status ? `${j.status} ${j.message}` : j.message;
        }
      } catch {
        // 네트워크 차단 등 — 사유 없이 진행
      }
      if (cancelled) return;
      setReason(detail);
      console.error(
        `[KakaoStoreMap] 지도 로드 실패 (${where}) · origin=${window.location.origin}` +
          (detail ? ` · 카카오 응답: ${detail}` : " · 사유 조회 실패"),
      );
    }

    function initMap() {
      if (cancelled) return;
      const k = window.kakao;
      if (!k?.maps?.LatLng) { void fail("SDK 미로드"); return; }
      if (!containerRef.current) return;   // 아직 마운트 전 — 다음 렌더에서 재시도
      try {
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
      } catch (e) {
        console.error("[KakaoStoreMap] 지도 초기화 예외:", e);
        void fail("초기화 예외");
      }
    }

    // 이미 로드되었는지 확인
    if (window.kakao?.maps?.LatLng) {
      initMap();
      return () => { cancelled = true; };
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // 다른 인스턴스가 로딩 중 — ready 이벤트를 기다린다.
      if (window.kakao?.maps?.load) window.kakao.maps.load(initMap);
      else timer = setTimeout(initMap, 300);   // 그래도 없으면 initMap이 fail 처리
      return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = sdkUrl;
    script.onload = () => {
      if (cancelled) return;
      window.kakao.maps.load(initMap);
    };
    script.onerror = () => {
      // 실패한 태그를 남기면 이후 마운트가 전부 "이미 로딩 중"으로 빠져 고착된다.
      script.remove();
      void fail("SDK 요청 거절");
    };
    document.head.appendChild(script);

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [lat, lng, label, radius, apiKey, attempt]);

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

  // 에러여도 컨테이너는 계속 마운트해 둔다 — 그래야 '다시 시도'가 지도를 그릴 수 있다.
  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
          <p className="text-[11px] text-slate-500">지도 로드 중…</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-rose-50 px-4">
          <div className="text-center">
            <p className="text-[12px] font-semibold text-rose-700">지도 로드 실패</p>
            {reason ? (
              <p className="mt-1 break-all font-mono text-[10px] text-rose-600">{reason}</p>
            ) : (
              <p className="mt-1 text-[11px] text-rose-600">사유를 받지 못했습니다(네트워크·CSP 확인).</p>
            )}
            <p className="mt-1.5 text-[11px] text-slate-600">
              이 주소가 카카오 콘솔(플랫폼 &gt; Web &gt; 사이트 도메인)에 등록돼 있어야 합니다:
            </p>
            <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
              {typeof window === "undefined" ? "" : window.location.origin}
            </p>
            <button
              onClick={retry}
              className="mt-2.5 border-[2px] border-[#0a0a0a] bg-white px-3 py-1 text-[11px] font-bold shadow-[2px_2px_0_0_#0a0a0a] transition hover:bg-yellow-100"
            >
              ↻ 다시 시도
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
