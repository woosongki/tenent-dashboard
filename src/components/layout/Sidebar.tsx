"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(auth)/login/_actions/auth";
import { SIDEBAR_THEMES, type SidebarTheme } from "@/lib/tokens";
import NotionSyncButton from "@/components/ui/NotionSyncButton";

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
function IconCalendar() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconBlueprint() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25z" />
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

type Role = "owner" | "admin" | "member";
interface NavItem { href: string; label: string; icon: React.ReactElement; roles?: Role[] }
interface NavGroup { section: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    section: "개요",
    items: [
      { href: "/dashboard",           label: "대시보드",    icon: <IconHome /> },
    ],
  },
  {
    section: "분석",
    items: [
      { href: "/dashboard/sales",     label: "매출분석",       icon: <IconChart /> },
      { href: "/dashboard/drilldown", label: "입점계획(26년)", icon: <IconBuilding /> },
      { href: "/dashboard/vacancy",   label: "공실해결",       icon: <IconKey /> },
      { href: "/dashboard/goals",     label: "컨텐츠 풀",     icon: <IconArchive /> },
      { href: "/dashboard/calendar",  label: "52주 캘린더",   icon: <IconCalendar /> },
      { href: "/dashboard/floorplans",label: "전점도면",       icon: <IconBlueprint /> },
      { href: "/dashboard/branch",    label: "상권분석",       icon: <IconMap /> },
    ],
  },
  {
    section: "관리",
    items: [
      { href: "/dashboard/admin/users", label: "사용자 관리", icon: <IconUsers />, roles: ["owner","admin"] },
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
  role?: Role | null;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  theme?: SidebarTheme;
  onToggleTheme?: () => void;
}

export default function Sidebar({
  userEmail, role = null, onClose, collapsed = false, onToggleCollapse,
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
      className={`flex h-screen flex-shrink-0 flex-col border-r-[3px] ${t.border} ${t.bg} transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-[236px]"
      }`}
    >
      {/* ── 로고 ── */}
      <div className={`border-b-[3px] ${t.border} px-3 py-4`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border-[2px] border-[#0a0a0a] bg-yellow-300 text-[#0a0a0a] text-[16px] font-black shadow-[3px_3px_0_0_#0a0a0a]">
            L
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className={`text-[14px] font-extrabold uppercase tracking-wider ${t.text}`}>lifestyle</div>
              <div className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-[.14em]`}>이랜드리테일</div>
            </div>
          )}
          {onClose && !collapsed && (
            <button
              onClick={onClose}
              aria-label="사이드바 닫기"
              className={`flex h-7 w-7 items-center justify-center border-[2px] ${t.border} bg-white ${t.text} transition-colors hover:bg-yellow-300 md:hidden`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── 네비게이션 ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group) => {
          // role 제한이 있는 항목만 추리기 — 그룹이 통째로 비면 섹션 자체 숨김
          const items = group.items.filter(
            (it) => !it.roles || (role && it.roles.includes(role)),
          );
          if (items.length === 0) return null;
          return (
          <div key={group.section} className="mb-3">
            {!collapsed && (
              <p className={`mb-2 px-3 pt-3 text-[10px] font-extrabold tracking-[.16em] uppercase ${t.textMuted}`}>
                {group.section}
              </p>
            )}
            {collapsed && <div className="pt-3" />}
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`relative flex items-center transition-colors ${
                    collapsed ? "justify-center px-0 py-3" : "gap-2.5 pl-3 pr-2 py-2.5"
                  } ${
                    active
                      ? `${t.itemActive} ${t.textActive}`
                      : `${t.itemBase} ${t.itemHover}`
                  }`}
                >
                  <span
                    className={`h-[16px] w-[16px] shrink-0 [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-current`}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="text-[13px] font-bold">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* ── 글로벌 노션 동기화 ── */}
      <div className={`border-t-[2px] ${t.border} p-2 flex flex-col gap-1`}>
        <NotionSyncButton variant="sidebar" collapsed={collapsed} themeIsLight={theme === "light"} />
      </div>

      {/* ── collapse + theme 토글 (데스크톱 전용) ── */}
      {(onToggleCollapse || onToggleTheme) && (
        <div className={`border-t-[2px] ${t.border} p-2 hidden md:flex md:flex-col gap-1`}>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === "dark" ? "사이드바 라이트 톤" : "사이드바 다크 톤"}
              className={`flex w-full items-center px-2 py-2 ${t.itemBase} transition-colors ${t.itemHover} ${
                collapsed ? "justify-center" : "gap-2"
              }`}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
              {!collapsed && <span className="text-[11px] font-bold uppercase tracking-wider">{theme === "dark" ? "Light" : "Dark"}</span>}
            </button>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className={`flex w-full items-center px-2 py-2 ${t.itemBase} transition-colors ${t.itemHover} ${
                collapsed ? "justify-center" : "gap-2"
              }`}
            >
              {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
              {!collapsed && <span className="text-[11px] font-bold uppercase tracking-wider">Collapse</span>}
            </button>
          )}
        </div>
      )}

      {/* ── 유저 영역 ── */}
      <div className={`border-t-[2px] ${t.border} p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          <div className="flex h-[34px] w-[34px] items-center justify-center border-[2px] border-[#0a0a0a] bg-cyan-400 text-[#0a0a0a] text-[14px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a]">
            {initial}
          </div>
        ) : (
          <div className={`flex items-center gap-2 ${t.userBg} px-2 py-2 shadow-[3px_3px_0_0_#0a0a0a]`}>
            <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center border-[2px] border-[#0a0a0a] bg-cyan-400 text-[#0a0a0a] text-[13px] font-extrabold">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[11.5px] font-bold ${theme === "dark" ? "text-white" : "text-[#0a0a0a]"}`}>{userEmail}</p>
              <p className={`text-[10px] font-bold uppercase tracking-[.14em] ${t.textMuted}`}>ADMIN</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="로그아웃"
                className={`flex h-7 w-7 items-center justify-center border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] transition-colors hover:bg-yellow-300`}
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
