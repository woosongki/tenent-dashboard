"use client";

import dynamic from "next/dynamic";

// react-leaflet은 window에 의존 → SSR 비활성화 (클라이언트 컴포넌트에서만 가능)
const HomeplusMapClient = dynamic(() => import("./HomeplusMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#FAF7EC]">
      <div className="text-[12px] font-bold text-slate-500">지도 로딩중…</div>
    </div>
  ),
});

export default function MapShell() {
  return <HomeplusMapClient />;
}
