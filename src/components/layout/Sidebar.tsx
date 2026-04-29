"use client";

import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(auth)/login/_actions/auth";
import { SIDEBAR_THEMES, type SidebarTheme } from "@/lib/tokens";

// ── SVG 아이콘 ────────────────────────────────────────────────
function IconHome() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}
function IconArchive() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
function IconMap() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}
function IconStore() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

const NAV = [
  {
    section: "OVERVIEW",
    items: [
      { href: "/dashboard",           label: "대시보드",    icon: <IconHome /> },
    ],
  },
  {
    section: "ANALYTICS",
    items: [
      { href: "/dashboard/sales",     label: "매출분석",       icon: <IconChart /> },
      { href: "/dashboard/drilldown", label: "입점계획(26년)", icon: <IconBuilding /> },
      { href: "/dashboard/goals",     label: "컨텐츠 풀",     icon: <IconArchive /> },
      { href: "/dashboard/logs",      label: "상권분석",       icon: <IconMap /> },
      { href: "/dashboard/branch",    label: "지점정보",       icon: <IconStore /> },
    ],
  },
];

function IconSun() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m12.728 0-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

interface Props {
  userEmail: string;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  theme?: SidebarTheme;
  onToggleTheme?: () => void;
}

export default function Sidebar({
  userEmail, onClose, collapsed = false, onToggleCollapse,
  theme = "dark", onToggleTheme,
}: Props) {
  const pathname = usePathname();
  const t = SIDEBAR_THEMES[theme];

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const initial = (userEmail[0] ?? "U").toUpperCase();

  return (
    <aside
      className={`flex h-screen flex-shrink-0 flex-col border-r ${t.border} ${t.bg} transition-all duration-300 ${
        collapsed ? "w-[64px]" : "w-[232px]"
      }`}
    >
      {/* ── 로고 ── */}
      <div className={`border-b ${t.border} px-4 py-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-600 to-indigo-500 text-[13px] font-black text-white shadow-[0_4px_12px_rgba(124,58,237,0.4)]">
            G
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className={`text-[15px] font-bold tracking-tight ${t.text}`}>lifestyle</div>
              <div className={`text-[10px] ${t.textMuted}`}>이랜드리테일</div>
            </div>
          )}
          {/* 모바일 닫기 */}
          {onClose && !collapsed && (
            <button
              onClick={onClose}
              aria-label="사이드바 닫기"
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.textMuted} transition-colors ${t.itemHover} md:hidden`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── 네비게이션 ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group) => (
          <div key={group.section} className="mb-2">
            {!collapsed && (
              <p className={`mb-1 px-2 pt-3 text-[10px] font-semibold tracking-[.1em] ${t.textMuted}`}>
                {group.section}
              </p>
            )}
            {collapsed && <div className="pt-3" />}
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`relative mb-0.5 flex items-center rounded-[8px] transition-colors ${
                    collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-2.5 py-2.5"
                  } ${
                    active
                      ? `${t.itemActive} ${t.textActive}`
                      : `${t.itemBase} ${t.itemHover}`
                  }`}
                >
                  {active && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-violet-500" />
                  )}
                  <span
                    className={`h-[15px] w-[15px] shrink-0 [&>svg]:h-full [&>svg]:w-full ${
                      active ? "[&>svg]:stroke-violet-500" : "[&>svg]:stroke-current"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="text-[13px] font-medium">
                      {item.label}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── collapse + theme 토글 (데스크톱 전용) ── */}
      {(onToggleCollapse || onToggleTheme) && (
        <div className={`border-t ${t.border} p-2 hidden md:flex md:flex-col gap-1`}>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === "dark" ? "라이트 모드" : "다크 모드"}
              className={`flex w-full items-center rounded-[8px] px-2 py-2 ${t.itemBase} transition-colors ${t.itemHover} ${
                collapsed ? "justify-center" : "gap-2"
              }`}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
              {!collapsed && <span className="text-[12px] font-medium">{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>}
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className={`flex w-full items-center rounded-[8px] px-2 py-2 ${t.itemBase} transition-colors ${t.itemHover} ${
                collapsed ? "justify-center" : "gap-2"
              }`}
            >
              {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
              {!collapsed && <span className="text-[12px] font-medium">접기</span>}
            </button>
          )}
        </div>
      )}

      {/* ── 유저 영역 ── */}
      <div className={`border-t ${t.border} p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[12px] font-bold text-white">
            {initial}
          </div>
        ) : (
          <div className={`flex items-center gap-2.5 rounded-[10px] ${t.userBg} px-3 py-2.5`}>
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[12px] font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[12px] font-medium ${theme === "dark" ? "text-slate-400" : "text-slate-700"}`}>{userEmail}</p>
              <p className={`text-[10px] ${t.textMuted}`}>관리자</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="로그아웃"
                className={`flex h-6 w-6 items-center justify-center rounded-md ${t.textMuted} transition-colors ${t.itemHover}`}
              >
                <IconLogout />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
