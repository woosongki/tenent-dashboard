"use client";

// 대시보드 영역 에러 바운더리 — 서버/클라이언트 컴포넌트에서 throw된 에러를 잡아
// 빈 화면 대신 복구 가능한 UI를 보여준다.

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-[480px] border-[3px] border-[#0a0a0a] bg-white p-7 shadow-[8px_8px_0_0_#0a0a0a]">
        <div className="mb-3 inline-block border-[2px] border-[#0a0a0a] bg-red-400 px-3 py-1 font-mono text-[12px] font-bold">
          ERROR
        </div>
        <h1 className="font-display text-[26px] leading-tight text-[#0a0a0a]">
          문제가 발생했어요
        </h1>
        <p className="mt-2 text-[13px] text-slate-600">
          페이지를 불러오는 중 오류가 났습니다. 다시 시도하거나 잠시 후 새로고침해 주세요.
        </p>
        {error?.digest && (
          <p className="mt-3 break-all border-[2px] border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
            오류 코드: {error.digest}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={reset}
            className="flex-1 border-[3px] border-[#0a0a0a] bg-yellow-300 py-2.5 font-display text-[15px] text-[#0a0a0a] shadow-[4px_4px_0_0_#0a0a0a] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#0a0a0a]"
          >
            다시 시도
          </button>
          <a
            href="/dashboard"
            className="border-[3px] border-[#0a0a0a] bg-white px-5 py-2.5 font-bold text-[#0a0a0a] transition hover:bg-slate-100"
          >
            홈으로
          </a>
        </div>
      </div>
    </div>
  );
}
