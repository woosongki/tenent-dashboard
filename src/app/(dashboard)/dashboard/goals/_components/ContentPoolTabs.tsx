"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { PoolType } from "@/types/goals";
import { POOL_TYPE_LABELS } from "@/types/goals";

const TABS: { key: PoolType; icon: React.ReactNode }[] = [
  {
    key: "lifestyle",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707m12.728 0-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    key: "fnb",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5M6 10.608v6.134c0 1.135.845 2.098 1.976 2.192C9.303 19.035 10.645 19.09 12 19.09c1.355 0 2.697-.055 4.024-.166C17.155 18.84 18 17.877 18 16.742v-6.134M12 3v1.5m0 0c-1.355 0-2.697.056-4.024.166C6.845 4.76 6 5.723 6 6.858m6-3.358c1.355 0 2.697.056 4.024.166C17.155 4.76 18 5.723 18 6.858M6 6.858v1.75M18 6.858v1.75" />
      </svg>
    ),
  },
  {
    key: "popup",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
];

interface Props {
  active: PoolType;
}

export default function ContentPoolTabs({ active }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const switchTab = useCallback((tab: PoolType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[#e8ecf0] bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      {TABS.map(({ key, icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`
              relative flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all
              ${isActive
                ? "bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.3)]"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }
            `}
          >
            <span className={isActive ? "text-violet-200" : "text-slate-400"}>
              {icon}
            </span>
            {POOL_TYPE_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
