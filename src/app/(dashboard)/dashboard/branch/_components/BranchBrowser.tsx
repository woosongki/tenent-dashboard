"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Store } from "@/lib/stores";
import { BRAND_BADGE } from "@/lib/stores";
import { TRADE_AREA_BADGE, type TradeAreaIndexItem } from "@/lib/tradeArea";

interface Props {
  stores: Store[];
  taItems: TradeAreaIndexItem[];
}

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
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지점명·브랜드·지역 검색 (예: 강남, NC, 서울)"
            className="w-full rounded-lg border border-[#e8ecf0] bg-white pl-9 pr-9 py-2 text-sm placeholder-slate-400 shadow-[0_1px_2px_rgba(15,23,42,.04)] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="검색어 지우기"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 tabular-nums">
          {q ? (
            <>
              <span className="font-semibold text-slate-700">{filtered.length}</span>
              <span className="text-slate-400"> / {stores.length} 점포</span>
            </>
          ) : (
            <>{stores.length} 점포</>
          )}
        </p>
      </div>

      {/* ── 점포 그리드 ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">
            검색어 <span className="font-medium text-slate-700">&quot;{q}&quot;</span>에 해당하는 점포가 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((s) => {
            const ta = taMap.get(s.id);
            return (
              <Link
                key={s.id}
                href={`/dashboard/branch/${s.id}`}
                className="group rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)] hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(0,0,0,.06)] transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded border ${BRAND_BADGE[s.brand]}`}>
                      {s.brand}
                    </span>
                    {s.hasKimsclub && (
                      <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                        킴스클럽
                      </span>
                    )}
                  </div>
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 group-hover:text-slate-700">
                  {s.name}
                </h3>
                <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
                  {s.region1} {s.region2}
                  {s.region3 ? ` ${s.region3}` : ""}
                </p>

                {ta ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${TRADE_AREA_BADGE[ta.tradeAreaType] ?? TRADE_AREA_BADGE["복합 상권"]}`}
                    >
                      {ta.tradeAreaType}
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {ta.total.toLocaleString()}개 점포
                    </span>
                    {ta.competitorCount > 0 && (
                      <span className="text-[10px] text-rose-600 font-medium">
                        ⚠ 경쟁점 {ta.competitorCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-400">
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
