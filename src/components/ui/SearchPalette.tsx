"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface NavItem {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  keywords: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "대시보드",
    description: "브랜드 성과 요약 · 매출 성장 순위",
    href: "/dashboard",
    keywords: ["dashboard", "홈", "home", "summary"],
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "매출분석",
    description: "카테고리·브랜드별 매출 및 이익 현황",
    href: "/dashboard/sales",
    keywords: ["sales", "매출", "이익", "revenue", "performance", "매출분석"],
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "입점계획(26년)",
    description: "이랜드리테일 2026년 입점 계획 데이터",
    href: "/dashboard/drilldown",
    keywords: ["drilldown", "입점", "유치", "attraction", "브랜드", "26년", "2026"],
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    label: "컨텐츠 풀",
    description: "목표 설정 · 진행률 추적 · 상태 관리",
    href: "/dashboard/goals",
    keywords: ["goals", "목표", "컨텐츠", "pool", "content", "컨텐츠풀"],
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: "상권분석",
    description: "이랜드리테일 41개 점포 · 주변 상권 · 상업용 실거래가",
    href: "/dashboard/branch",
    keywords: ["branch", "지점", "store", "매장", "점포", "상권", "trade", "area", "상권분석"],
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

interface RemoteResult {
  type: "goal" | "vendor" | "market" | "attraction";
  id: string;
  label: string;
  description: string;
  href: string;
}

interface UnifiedItem {
  key: string;
  label: string;
  description: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
}

const TYPE_BADGE: Record<RemoteResult["type"], string> = {
  goal:       "목표",
  vendor:     "F&B",
  market:     "시세",
  attraction: "입점",
};

export default function SearchPalette({ open, onClose }: Props) {
  const [query, setQuery]       = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [remote, setRemote]     = useState<RemoteResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);
  const router                  = useRouter();

  // 로컬 NAV 필터
  const navFiltered: UnifiedItem[] = (
    query.trim()
      ? NAV_ITEMS.filter((item) => {
          const q = query.toLowerCase();
          return (
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.keywords.some((k) => k.includes(q))
          );
        })
      : NAV_ITEMS
  ).map((n) => ({
    key: n.href, label: n.label, description: n.description, href: n.href, icon: n.icon, badge: "페이지",
  }));

  const remoteItems: UnifiedItem[] = remote.map((r) => ({
    key: `${r.type}-${r.id}`,
    label: r.label,
    description: r.description,
    href: r.href,
    badge: TYPE_BADGE[r.type],
  }));

  const filtered = [...navFiltered, ...remoteItems];

  // ── 디바운스 글로벌 검색 ─────────────────────────────────
  useEffect(() => {
    if (!open || query.trim().length < 2) { setRemote([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setRemote(json.results ?? []);
      } catch {
        setRemote([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  // 열릴 때 input focus
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // active index를 결과 범위 내로 보정
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIdx]) {
      navigate(filtered[activeIdx]!.href);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* 팔레트 */}
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#e8ecf0] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 검색 입력 */}
        <div className="flex items-center gap-3 border-b border-[#f1f5f9] px-4 py-3.5">
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="페이지·목표·업체·시세 검색…"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-300 focus:outline-none"
          />
          {loading && (
            <svg className="h-3.5 w-3.5 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          <kbd className="hidden shrink-0 rounded border border-[#e8ecf0] px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
            ESC
          </kbd>
        </div>

        {/* 결과 목록 */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              검색 결과가 없습니다.
            </div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.key}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  i === activeIdx ? "bg-violet-50" : "hover:bg-slate-50"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  i === activeIdx ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-500"
                }`}>
                  {item.icon ?? <span className="text-[10px] font-bold">{item.badge?.[0]}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] font-semibold ${i === activeIdx ? "text-violet-700" : "text-slate-700"}`}>
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {item.description}
                  </span>
                </span>
                {item.badge && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    i === activeIdx ? "bg-violet-200 text-violet-700" : "bg-slate-100 text-slate-400"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* 푸터 힌트 */}
        <div className="flex items-center gap-3 border-t border-[#f1f5f9] px-4 py-2.5">
          <span className="flex items-center gap-1 text-[10px] text-slate-300">
            <kbd className="rounded border border-[#e8ecf0] px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>
            탐색
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-300">
            <kbd className="rounded border border-[#e8ecf0] px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
            이동
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-300">
            <kbd className="rounded border border-[#e8ecf0] px-1 py-0.5 font-mono text-[9px]">Esc</kbd>
            닫기
          </span>
        </div>
      </div>
    </div>
  );
}
