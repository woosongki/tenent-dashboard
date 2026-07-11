"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function IconRefresh({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`h-[15px] w-[15px] ${spinning ? "animate-spin" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// 서버 데이터만 다시 받는 새로고침 — 탭/필터/스크롤 등 클라이언트 상태는 유지(전체 리로드 대체).
export default function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  function onClick() {
    setSpinning(true);
    startTransition(() => router.refresh());
    // 최소 스핀 시간 확보(즉시 끝나도 시각 피드백)
    window.setTimeout(() => setSpinning(false), 600);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="새로고침 (데이터만 갱신 · 필터·스크롤 유지)"
      aria-label="새로고침"
      className="flex h-8 w-8 items-center justify-center border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] transition-colors hover:bg-yellow-300 disabled:opacity-60"
    >
      <IconRefresh spinning={spinning || pending} />
    </button>
  );
}
