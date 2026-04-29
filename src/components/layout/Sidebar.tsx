"use client";

import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(auth)/login/_actions/auth";

const NAV = [
  {
    section: "OVERVIEW",
    items: [
      {
        href: "/dashboard",
        label: "대시보드",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },
  {
    section: "ANALYTICS",
    items: [
      {
        href: "/dashboard/sales",
        label: "판매분석",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/drilldown",
        label: "입점 현황",
        badge: "26",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/goals",
        label: "컨텐츠 POOL",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
      },
      {
        href: "/dashboard/logs",
        label: "상권분석",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        ),
      },
    ],
  },
];

interface Props {
  userEmail: string;
}

export default function Sidebar({ userEmail }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const initial = (userEmail[0] ?? "U").toUpperCase();

  return (
    <aside className="flex h-screen w-[232px] flex-shrink-0 flex-col border-r border-[#1a2236] bg-[#0c111d]">
      {/* Logo */}
      <div className="border-b border-[#1a2236] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-600 to-indigo-500 text-[13px] font-black text-white shadow-[0_4px_12px_rgba(124,58,237,0.4)]">
            G
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight text-slate-100">lifestyle</div>
            <div className="text-[10px] text-[#1e3a5f]">이랜드리테일</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map((group) => (
          <div key={group.section} className="mb-2">
            <p className="mb-1 px-2 pt-3 text-[10px] font-semibold tracking-[.1em] text-[#1e3a5f]">
              {group.section}
            </p>
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`relative mb-0.5 flex items-center gap-2.5 rounded-[8px] px-2.5 py-2.5 transition-colors ${
                    active
                      ? "bg-[#1a1040] text-violet-300"
                      : "text-[#334155] hover:bg-[#131c2e] hover:text-slate-400"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-violet-500" />
                  )}
                  <span className={`h-[15px] w-[15px] shrink-0 [&>svg]:h-full [&>svg]:w-full ${active ? "[&>svg]:stroke-violet-400" : "[&>svg]:stroke-current"}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[13px] font-medium ${active ? "text-violet-300" : ""}`}>
                    {item.label}
                  </span>
                  {"badge" in item && item.badge && (
                    <span className="ml-auto rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-[#1a2236] p-3">
        <div className="flex items-center gap-2.5 rounded-[10px] bg-[#111827] px-3 py-2.5">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[12px] font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-slate-400">{userEmail}</p>
            <p className="text-[10px] text-[#1e3a5f]">관리자</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="로그아웃"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#1e3a5f] transition-colors hover:bg-[#1a2236] hover:text-slate-500"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
