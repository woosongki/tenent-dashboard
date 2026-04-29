"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";

interface Props {
  userEmail: string;
  children: React.ReactNode;
}

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export default function AppShell({ userEmail, children }: Props) {
  const [open, setOpen] = useState(false);

  // 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  // 열릴 때 body 스크롤 막기
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f9]">

      {/* ── 모바일 오버레이 ── */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── 사이드바 (모바일: drawer, 데스크톱: fixed) ── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <Sidebar userEmail={userEmail} onClose={() => setOpen(false)} />
      </div>

      {/* ── 메인 영역 ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* 모바일 전용 상단 바 */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e8ecf0] bg-white px-4 md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 active:bg-slate-100"
          >
            <IconMenu />
          </button>
          {/* 모바일 로고 */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-violet-600 to-indigo-500 text-[11px] font-black text-white">
              G
            </div>
            <span className="text-[14px] font-bold tracking-tight text-slate-800">lifestyle</span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
