"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOutAction } from "@/app/(auth)/login/_actions/auth";
import { SIDEBAR_THEMES, type SidebarTheme } from "@/lib/tokens";
import { menuKeyForPath } from "@/lib/nav";
import NotionSyncButton from "@/components/ui/NotionSyncButton";
import type { RecentMeetingItem } from "@/lib/meetings/recent";

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
function IconAlert() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
function IconKeyword() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  );
}
function IconSofa() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4m-14 0a2 2 0 0 0-2 2v3h18v-3a2 2 0 0 0-2-2m-14 0a2 2 0 0 1 2 2v1h10v-1a2 2 0 0 1 2-2M5 18v2m14-2v2" />
    </svg>
  );
}
function IconHandshake() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5l3-3 4 3 2-2 4 2 3-3M3 14l3-3 4 3 2-2 4 2 3-3M9 17l3-3 3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
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
function IconChevronDown() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

type Role = "owner" | "admin" | "member";
interface NavChild {
  href: string;
  label: string;
  layer?: string;
  dotColor?: string;
  /** 같은 group 값을 가진 연속된 아이템들은 접기 가능한 그룹으로 묶임 */
  group?: string;
}
interface NavItem {
  href: string;
  label: string;
  icon: React.ReactElement;
  roles?: Role[];
  /** 하위 메뉴 — 있으면 펼침 버튼으로 렌더 */
  children?: NavChild[];
}
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
      { href: "/dashboard/bcd",       label: "BCD 분석",       icon: <IconTarget /> },
      { href: "/dashboard/drilldown", label: "입점계획(26년)", icon: <IconBuilding /> },
      { href: "/dashboard/vacancy",   label: "공실해결",       icon: <IconKey /> },
      { href: "/dashboard/goals",     label: "컨텐츠 풀",     icon: <IconArchive /> },
      { href: "/dashboard/calendar",  label: "52주 캘린더",   icon: <IconCalendar /> },
      { href: "/dashboard/living",    label: "리빙 주제전",    icon: <IconSofa /> },
      { href: "/dashboard/floorplans",label: "전점도면",       icon: <IconBlueprint /> },
      { href: "/dashboard/branch",    label: "상권분석",       icon: <IconMap /> },
      // 컨텐츠 검증(/dashboard/verify)은 업체미팅 'AI 심층분석'으로 흡수 → 사이드바에서 은퇴(라우트는 유지).
      { href: "/dashboard/brand-keyword", label: "브랜드 키워드", icon: <IconKeyword /> },
      { href: "/dashboard/brand-fit", label: "브랜드 적합도",  icon: <IconTarget /> },
      {
        href: "/dashboard/homeplus",
        label: "리테일 지도",
        icon: <IconAlert />,
        children: [
          // 백화점
          { href: "/dashboard/homeplus?layer=lotte",           label: "롯데백화점 30점",     layer: "lotte",      dotColor: "#a4133c", group: "백화점" },
          { href: "/dashboard/homeplus?layer=hyundai",         label: "현대백화점 13점",     layer: "hyundai",    dotColor: "#1d3557", group: "백화점" },
          { href: "/dashboard/homeplus?layer=shinsegae",       label: "신세계백화점 10점",   layer: "shinsegae",  dotColor: "#495057", group: "백화점" },
          { href: "/dashboard/homeplus?layer=ak",              label: "AK백화점 3점",        layer: "ak",         dotColor: "#6f1d77", group: "백화점" },
          { href: "/dashboard/homeplus?layer=galleria",        label: "갤러리아 6점",        layer: "galleria",   dotColor: "#2d5016", group: "백화점" },
          // 브랜드
          { href: "/dashboard/homeplus?layer=artbox",          label: "아트박스 203점",      layer: "artbox",     dotColor: "#f72585", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=abcmart",         label: "ABC마트 322점",       layer: "abcmart",    dotColor: "#e63946", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=8seconds",        label: "에잇세컨즈 78점",     layer: "8seconds",   dotColor: "#fbbf24", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=spao",            label: "스파오 184점",        layer: "spao",       dotColor: "#0b3d91", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=mixxo",           label: "미쏘 55점",           layer: "mixxo",      dotColor: "#e6007e", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=daiso",           label: "다이소 1,714점",      layer: "daiso",      dotColor: "#f9c74f", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=oliveyoung",      label: "올리브영 1,363점",    layer: "oliveyoung", dotColor: "#52b788", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=modernhouse",     label: "모던하우스 143점",    layer: "modernhouse", dotColor: "#6a2c70", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=muji",            label: "무인양품 46점",       layer: "muji",       dotColor: "#6f4e37", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=hanssem",         label: "한샘디자인파크 22점", layer: "hanssem",    dotColor: "#1e5fa3", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=livart",          label: "현대리바트 92점",     layer: "livart",     dotColor: "#ec4899", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=iloom",           label: "일룸 92점",           layer: "iloom",      dotColor: "#ca8a04", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=nitori",          label: "니토리 6점",          layer: "nitori",     dotColor: "#ea580c", group: "브랜드" },
          { href: "/dashboard/homeplus?layer=uniqlo",          label: "유니클로 153점",      layer: "uniqlo",     dotColor: "#be123c", group: "브랜드" },
          // 기타 (체인 매장 + 그 외)
          { href: "/dashboard/homeplus?layer=entersix",        label: "엔터식스 6점",        layer: "entersix",   dotColor: "#ff6f3c", group: "기타" },
          { href: "/dashboard/homeplus?layer=moda",            label: "모다아울렛 17점",     layer: "moda",       dotColor: "#00b4a0", group: "기타" },
          { href: "/dashboard/homeplus?layer=savezone",        label: "세이브존 9점",        layer: "savezone",   dotColor: "#95a847", group: "기타" },
          { href: "/dashboard/homeplus?layer=lf",              label: "LF스퀘어 3점",        layer: "lf",         dotColor: "#a08260", group: "기타" },
          // 마트
          { href: "/dashboard/homeplus?layer=emart",           label: "이마트 127점",        layer: "emart",      dotColor: "#ffc107", group: "마트" },
          { href: "/dashboard/homeplus?layer=lottemart",       label: "롯데마트 110점",      layer: "lottemart",  dotColor: "#d62828", group: "마트" },
          { href: "/dashboard/homeplus?layer=hanaromart",      label: "하나로마트 155점",    layer: "hanaromart", dotColor: "#2d6a4f", group: "마트" },
        ],
      },
    ],
  },
  {
    section: "미팅",
    items: [
      { href: "/dashboard/meetings", label: "업체미팅", icon: <IconHandshake /> },
      { href: "/dashboard/contracts/expiry", label: "계약만료 알람", icon: <IconArchive /> },
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
function IconBriefcase() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.184 2.184 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  );
}

interface Props {
  userEmail: string;
  role?: Role | null;
  hiddenMenus?: string[];
  recentMeetings?: RecentMeetingItem[];
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  theme?: SidebarTheme;
  onToggleTheme?: () => void;
  reportMode?: boolean;
  onToggleReportMode?: () => void;
}

export default function Sidebar({
  userEmail, role = null, hiddenMenus = [], recentMeetings = [], onClose, collapsed = false, onToggleCollapse,
  theme = "dark", onToggleTheme,
  reportMode = false, onToggleReportMode,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLayer = searchParams?.get("layer") ?? "";
  const t = SIDEBAR_THEMES[theme];

  // 정적 NAV에 "업체미팅 children (최근 미팅 리스트 + 새 업체)" 동적 주입.
  // recentMeetings는 서버 layout에서 최근 세션 순으로 정렬됨.
  const NAV_DYNAMIC = useMemo<NavGroup[]>(() => {
    return NAV.map((g) => ({
      ...g,
      items: g.items.map((it) => {
        if (it.href !== "/dashboard/meetings") return it;
        // group을 지정하지 않아 접힘 헤더 없이 평평한 리스트로 렌더.
        const meetingChildren: NavChild[] = [
          { href: "/dashboard/meetings", label: "+ 새 업체" },
          ...recentMeetings.map((m) => {
            const badge = m.sessionCount > 0 ? ` · ${m.sessionCount}차` : "";
            return {
              href: `/dashboard/meetings/${m.id}`,
              label: `${m.brand}${badge}`,
            } as NavChild;
          }),
        ];
        return { ...it, children: meetingChildren };
      }),
    }));
  }, [recentMeetings]);

  // 펼쳐진 부모 메뉴 추적. 현재 경로 기준 자동 펼침 + 클릭 토글.
  // 업체미팅은 항상 펼침(사용자 명시적으로 접을 수도 있게 초기 open만 강제).
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV_DYNAMIC.forEach((g) => g.items.forEach((it) => {
      if (it.children && pathname.startsWith(it.href)) initial.add(it.href);
    }));
    initial.add("/dashboard/meetings");
    return initial;
  });

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }
  function isChildActive(parentHref: string, child: NavChild) {
    // 리테일 지도: layer 쿼리 기준
    if (parentHref === "/dashboard/homeplus") {
      if (!pathname.startsWith(parentHref)) return false;
      const expectedLayer = child.layer ?? "";
      if (!expectedLayer) return currentLayer === "" || currentLayer === "homeplus";
      return currentLayer === expectedLayer;
    }
    // 업체미팅 등 나머지: pathname 정확 매칭
    return pathname === child.href;
  }
  function toggleExpanded(href: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }
  // 하위 그룹(백화점/기타/마트) 접힘 상태 — 기본 모두 펼쳐짐
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  // children을 연속된 group 단위로 묶음 (group이 없으면 단독 블록)
  function chunkChildren(children: NavChild[]) {
    const chunks: { group?: string; items: NavChild[] }[] = [];
    for (const c of children) {
      const last = chunks[chunks.length - 1];
      if (last && last.group === c.group) last.items.push(c);
      else chunks.push({ group: c.group, items: [c] });
    }
    return chunks;
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
              <div className={`font-display text-[18px] leading-none ${t.text}`}>lifestyle</div>
              <div className={`mt-1 text-[10px] font-bold ${t.textMuted} uppercase tracking-[.14em]`}>이랜드리테일</div>
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
        {NAV_DYNAMIC.map((group) => {
          // role 제한 + 사용자별 숨김(hidden_menus) 반영 — 그룹이 통째로 비면 섹션 자체 숨김
          const items = group.items.filter((it) => {
            if (it.roles && !(role && it.roles.includes(role))) return false;
            const key = menuKeyForPath(it.href);
            return !(key && hiddenMenus.includes(key));
          });
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
              const hasChildren = !!item.children?.length;
              const isExpanded = expanded.has(item.href);

              // 하위 메뉴가 없거나 collapsed 모드면 기존 Link 렌더
              if (!hasChildren || collapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`relative flex items-center transition-colors ${
                      collapsed ? "justify-center px-0 py-3" : "gap-2.5 pl-3 pr-2 py-2.5"
                    } ${active ? `${t.itemActive} ${t.textActive}` : `${t.itemBase} ${t.itemHover}`}`}
                  >
                    <span className="h-[16px] w-[16px] shrink-0 [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-current">
                      {item.icon}
                    </span>
                    {!collapsed && <span className="text-[13px] font-bold">{item.label}</span>}
                  </Link>
                );
              }

              // 펼침 가능한 부모 메뉴
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.href)}
                    className={`relative flex w-full items-center gap-2.5 pl-3 pr-2 py-2.5 transition-colors ${
                      active ? `${t.itemActive} ${t.textActive}` : `${t.itemBase} ${t.itemHover}`
                    }`}
                  >
                    <span className="h-[16px] w-[16px] shrink-0 [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-current">
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left text-[13px] font-bold">{item.label}</span>
                    <span className={`shrink-0 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                      <IconChevronDown />
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-0.5 mb-1 ml-3 border-l-[2px] border-[#0a0a0a]/15 pl-1">
                      {chunkChildren(item.children!).map((chunk, ci) => {
                        const groupKey = `${item.href}::${chunk.group ?? "__"}`;
                        const groupCollapsed = chunk.group ? collapsedGroups.has(groupKey) : false;
                        return (
                          <div key={ci}>
                            {chunk.group && (
                              <button
                                type="button"
                                onClick={() => toggleGroup(groupKey)}
                                className={`mt-1.5 flex w-full items-center gap-1.5 pl-2 pr-1 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] ${t.textMuted} hover:${t.text}`}
                              >
                                <span className={`shrink-0 transition-transform ${groupCollapsed ? "-rotate-90" : "rotate-0"}`}>
                                  <IconChevronDown />
                                </span>
                                <span className="flex-1 text-left">{chunk.group}</span>
                                <span className="font-mono text-[9.5px] opacity-60">{chunk.items.length}</span>
                              </button>
                            )}
                            {!groupCollapsed && chunk.items.map((child) => {
                              const childActive = isChildActive(item.href, child);
                              return (
                                <Link
                                  key={child.href + (child.layer ?? "")}
                                  href={child.href}
                                  className={`flex items-center gap-2 pr-2 py-2 text-[12px] font-bold transition-colors ${
                                    chunk.group ? "pl-6" : "pl-3"
                                  } ${childActive ? `${t.itemActive} ${t.textActive}` : `${t.itemBase} ${t.itemHover}`}`}
                                >
                                  {child.dotColor && (
                                    <span
                                      className="inline-block h-2 w-2 shrink-0 border border-[#0a0a0a]/30"
                                      style={{ background: child.dotColor, borderRadius: child.dotColor === "#52b788" ? "50%" : 0 }}
                                    />
                                  )}
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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

      {/* ── collapse + theme + report 토글 (데스크톱 전용) ── */}
      {(onToggleCollapse || onToggleTheme || onToggleReportMode) && (
        <div className={`border-t-[2px] ${t.border} p-2 hidden md:flex md:flex-col gap-1`}>
          {onToggleReportMode && (
            <button
              onClick={onToggleReportMode}
              title={reportMode ? "임원 모드 해제 (형광)" : "임원 모드 켜기 (톤다운)"}
              className={`flex w-full items-center px-2 py-2 transition-colors ${
                reportMode
                  ? "bg-yellow-200 text-[#0a0a0a] border-l-[3px] border-[#0a0a0a]"
                  : `${t.itemBase} ${t.itemHover} border-l-[3px] border-transparent`
              } ${collapsed ? "justify-center" : "gap-2"}`}
            >
              <IconBriefcase />
              {!collapsed && (
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {reportMode ? "Report ON" : "Report"}
                </span>
              )}
            </button>
          )}
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
          <div className={`flex items-center gap-2 ${t.userBg} px-2.5 py-2 shadow-[3px_3px_0_0_#0a0a0a]`}>
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border-[2px] border-[#0a0a0a] bg-cyan-400 text-[#0a0a0a] font-mono text-[14px] font-extrabold">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[11.5px] font-extrabold font-mono ${theme === "dark" ? "text-white" : "text-[#0a0a0a]"}`}>{userEmail}</p>
              <p className={`text-[9.5px] font-extrabold uppercase tracking-[.16em] mt-0.5 ${t.textMuted}`}>· ADMIN</p>
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
