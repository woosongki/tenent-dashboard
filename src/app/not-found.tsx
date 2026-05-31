// 전역 404 페이지 — 존재하지 않는 경로 접근 시 표시.

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f0] p-6">
      <div className="w-full max-w-[480px] border-[3px] border-[#0a0a0a] bg-white p-8 shadow-[8px_8px_0_0_#0a0a0a]">
        <div className="font-display text-[64px] leading-none text-[#0a0a0a]">404</div>
        <div className="mb-3 mt-1 inline-block border-[2px] border-[#0a0a0a] bg-cyan-300 px-3 py-1 font-mono text-[12px] font-bold">
          NOT FOUND
        </div>
        <h1 className="font-display text-[22px] leading-tight text-[#0a0a0a]">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-2 text-[13px] text-slate-600">
          주소가 바뀌었거나 삭제된 페이지일 수 있습니다.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block border-[3px] border-[#0a0a0a] bg-yellow-300 px-6 py-2.5 font-display text-[15px] text-[#0a0a0a] shadow-[4px_4px_0_0_#0a0a0a] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#0a0a0a]"
        >
          대시보드로 가기
        </Link>
      </div>
    </div>
  );
}
