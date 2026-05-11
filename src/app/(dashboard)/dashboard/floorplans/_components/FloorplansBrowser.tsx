"use client";

import { useMemo, useState } from "react";
import type { Store } from "@/lib/stores";
import type { Floorplan } from "@/lib/floorplans/queries";
import StoreFloorplansCard from "./StoreFloorplansCard";

interface Props {
  stores: Store[];
  grouped: Record<string, Floorplan[]>;
  brandOrder: string[];
  brandColor: Record<string, { bg: string; text: string; hex: string }>;
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

export default function FloorplansBrowser({
  stores,
  grouped,
  brandOrder,
  brandColor,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => stores.filter((s) => matches(s, q.trim())), [stores, q]);

  const byBrand = useMemo(() => {
    const acc: Record<string, Store[]> = {};
    for (const s of filtered) (acc[s.brand] ??= []).push(s);
    return acc;
  }, [filtered]);

  return (
    <div className="space-y-6">
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
            <>전체 <span className="font-mono font-extrabold text-[#0a0a0a]">{stores.length}</span> 점포</>
          )}
        </p>
      </div>

      {/* ── 브랜드별 섹션 ── */}
      {filtered.length === 0 ? (
        <div className="brutal bg-white p-12 text-center">
          <p className="text-[13px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
            검색어 <span className="font-mono text-[#0a0a0a]">&quot;{q}&quot;</span>에 해당하는 점포가 없습니다
          </p>
        </div>
      ) : (
        brandOrder.map((brand) => {
          const list = byBrand[brand];
          if (!list || list.length === 0) return null;
          const c = brandColor[brand];
          const brandFloors = list.reduce((sum, s) => sum + (grouped[s.id]?.length ?? 0), 0);
          const brandRegistered = list.filter((s) => (grouped[s.id]?.length ?? 0) > 0).length;

          return (
            <section key={brand} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 border-b-[2px] border-[#0a0a0a] pb-2.5">
                <span
                  className="inline-block border-[1.5px] border-[#0a0a0a] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white"
                  style={{ backgroundColor: c?.hex ?? "#94a3b8" }}
                >
                  {brand}
                </span>
                <span className="font-mono text-[11px] font-extrabold tabular-nums text-[#0a0a0a]/65 uppercase">
                  {brandRegistered}/{list.length} 점포 · {brandFloors}장
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {list.map((store) => (
                  <StoreFloorplansCard
                    key={store.id}
                    store={store}
                    brandColor={c}
                    initialFloors={grouped[store.id] ?? []}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
