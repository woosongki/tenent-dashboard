"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Store } from "@/lib/stores";
import { type TradeAreaIndexItem } from "@/lib/tradeAreaTypes";

interface Props {
  stores: Store[];
  taItems: TradeAreaIndexItem[];
}

// 브랜드 brutalist 컬러
const BRAND_BG: Record<string, string> = {
  "NC백화점":    "bg-violet-500 text-white",
  "뉴코아아울렛": "bg-rose-500 text-white",
  "2001아울렛":  "bg-emerald-400 text-emerald-950",
  "동아백화점":  "bg-cyan-400 text-cyan-950",
};

// 상권 유형 brutalist 컬러
const TA_BG: Record<string, string> = {
  "근린 상권":   "bg-emerald-200 text-emerald-950",
  "지구 상권":   "bg-cyan-200 text-cyan-950",
  "복합 상권":   "bg-yellow-200 text-[#0a0a0a]",
  "중심 상권":   "bg-fuchsia-300 text-fuchsia-950",
  "역세권 상권": "bg-violet-300 text-violet-950",
};

function matches(store: Store, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [
    store.name,
    store.brand,
    store.region1 ?? "",
    store.region2 ?? "",
    store.region3 ?? "",
    store.address,
  ]
    .map((s) => s.toLowerCase())
    .some((s) => s.includes(needle));
}

export default function BranchBrowser({ stores, taItems }: Props) {
  const [q, setQ] = useState("");

  const taMap = useMemo(() => new Map(taItems.map((t) => [t.id, t])), [taItems]);

  const filtered = useMemo(
    () => stores.filter((s) => matches(s, q.trim())),
    [stores, q],
  );

  return (
    <div className="space-y-4">
      {/* ── 검색 바 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0a0a0a]/55"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지점명·브랜드·지역 검색 (예: 강남, NC, 서울)"
            className="w-full border-[2px] border-[#0a0a0a] bg-white pl-9 pr-9 py-2 text-[13px] font-medium placeholder:text-[#0a0a0a]/40 shadow-[3px_3px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[4px_4px_0_0_#0a0a0a] transition-all"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="검색어 지우기"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center border-[1.5px] border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-yellow-300 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
          {q ? (
            <>
              <span className="font-mono font-extrabold text-[#0a0a0a]">{filtered.length}</span>
              <span> / {stores.length} 점포</span>
            </>
          ) : (
            <><span className="font-mono font-extrabold text-[#0a0a0a]">{stores.length}</span> 점포</>
          )}
        </p>
      </div>

      {/* ── 점포 그리드 ── */}
      {filtered.length === 0 ? (
        <div className="brutal bg-white p-12 text-center">
          <p className="text-[13px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
            검색어 <span className="font-mono text-[#0a0a0a]">&quot;{q}&quot;</span>에 해당하는 점포가 없습니다
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((s) => {
            const ta = taMap.get(s.id);
            const brandCls = BRAND_BG[s.brand] ?? "bg-[#F1ECDB] text-[#0a0a0a]";
            const taCls = ta ? (TA_BG[ta.tradeAreaType] ?? "bg-[#F1ECDB] text-[#0a0a0a]") : "";
            return (
              <Link
                key={s.id}
                href={`/dashboard/branch/${s.id}`}
                className="group brutal-sm brutal-hover bg-white p-4 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider ${brandCls}`}>
                      {s.brand}
                    </span>
                    {s.hasKimsclub && (
                      <span className="inline-block border-[1.5px] border-[#0a0a0a] bg-yellow-300 px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">
                        킴스클럽
                      </span>
                    )}
                  </div>
                  <svg
                    className="h-4 w-4 shrink-0 text-[#0a0a0a]/30 group-hover:text-[#0a0a0a] group-hover:translate-x-0.5 transition-all"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="font-extrabold text-[14px] text-[#0a0a0a]">
                  {s.name}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-[#0a0a0a]/65 leading-relaxed">
                  {s.region1} {s.region2}
                  {s.region3 ? ` ${s.region3}` : ""}
                </p>

                {ta ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider ${taCls}`}>
                      {ta.tradeAreaType}
                    </span>
                    <span className="font-mono text-[10px] font-extrabold tabular-nums text-[#0a0a0a]/70">
                      {ta.total.toLocaleString()}개
                    </span>
                    {ta.competitorCount > 0 && (
                      <span className="inline-flex items-center gap-1 border-[1.5px] border-[#0a0a0a] bg-rose-500 px-1.5 py-0 text-[9.5px] font-extrabold uppercase tracking-wider text-white">
                        ⚠ {ta.competitorCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">
                    상권 데이터 준비 중
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
