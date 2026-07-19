"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import SearchPalette from "@/components/ui/SearchPalette";
import { OPEN_SEARCH_EVENT } from "./SearchTrigger";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import { useSidebarTheme } from "@/hooks/useSidebarTheme";
import { useReportMode } from "@/hooks/useReportMode";

interface Props {
  userEmail: string;
  role?: "owner" | "admin" | "member" | null;
  hiddenMenus?: string[];
  children: React.ReactNode;
}

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

export default function AppShell({ userEmail, role = null, hiddenMenus = [], children }: Props) {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [collapsed,  setCollapsed]    = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [theme, setTheme]             = useSidebarTheme();
  const [reportMode, setReportMode]   = useReportMode();

  // 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  // 데스크톱 레일 접힘 상태 복원 (섹션 접힘과 동일하게 localStorage 유지)
  useEffect(() => {
    try {
      // 마운트 후 1회 복원 (SSR엔 localStorage 없음) — 의도된 초기 동기화.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("sidebar:collapsed") === "1") setCollapsed(true);
    } catch { /* localStorage 접근 불가 시 펼침 유지 */ }
  }, []);

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("sidebar:collapsed", next ? "1" : "0"); } catch { /* 저장 실패 무시 */ }
      return next;
    });
  }

  // 열릴 때 body 스크롤 막기
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Cmd+K / Ctrl+K 글로벌 단축키
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // TopBar 검색 버튼(SearchTrigger)이 쏘는 글로벌 이벤트로도 열림
  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener(OPEN_SEARCH_EVENT, open);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, open);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF7EC]">

      {/* ── 모바일 오버레이 ── (Leaflet 지도 z~1000 위로 올림) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[1900] bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── 사이드바 ── (모바일 드로어는 지도 마커/컨트롤 위에 떠야 함) */}
      <div
        className={`
          fixed inset-y-0 left-0 z-[2000] transition-transform duration-300 ease-in-out
          md:relative md:z-auto md:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <Sidebar
          userEmail={userEmail}
          role={role}
          hiddenMenus={hiddenMenus}
          onClose={() => setMobileOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          reportMode={reportMode}
          onToggleReportMode={() => setReportMode(!reportMode)}
        />
      </div>

      {/* ── 메인 영역 ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* 모바일 전용 상단 바 */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#0a0a0a] bg-white px-4 md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="메뉴 열기"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 active:bg-slate-100"
            >
              <IconMenu />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-violet-600 to-indigo-500 text-[11px] font-black text-white">
                G
              </div>
              <span className="text-[14px] font-bold tracking-tight text-slate-800">lifestyle</span>
            </div>
          </div>
          {/* 모바일 검색 버튼 */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="검색"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
          >
            <IconSearch />
          </button>
        </div>

        {children}
      </div>

      {/* ── 의견·개선 제안 (전원) ── */}
      <FeedbackButton />

      {/* ── Cmd+K 검색 팔레트 ── */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
