"use client";

import { useEffect, useState } from "react";

// TopBar(서버 컴포넌트)에서 검색 팔레트를 여는 클라이언트 버튼.
// AppShell이 소유한 searchOpen 상태와는 글로벌 CustomEvent로 연결
// (트리 상 TopBar는 페이지 안, 상태는 AppShell에 있어 prop 드릴링 대신 이벤트 사용).

export const OPEN_SEARCH_EVENT = "lifestyle:open-search";

function IconSearch() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

export default function SearchTrigger() {
  // SSR 하이드레이션 불일치 방지: 초기엔 "Ctrl"로 렌더하고 마운트 후 플랫폼 감지로 보정.
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mac) setMod("⌘");
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT))}
      title="검색 (Ctrl/⌘ + K)"
      aria-label="검색"
      className="flex h-8 items-center gap-1.5 border-[2px] border-[#0a0a0a] bg-white px-2 text-[#0a0a0a] transition-colors hover:bg-yellow-300"
    >
      <IconSearch />
      <span className="hidden text-[11px] font-extrabold uppercase tracking-wider sm:inline">검색</span>
      <kbd className="hidden items-center border-[1.5px] border-[#0a0a0a]/40 bg-[#F1ECDB] px-1 py-px font-mono text-[9.5px] font-bold text-[#0a0a0a]/60 md:inline-flex">
        {mod}K
      </kbd>
    </button>
  );
}
