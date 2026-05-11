"use client";

import { useMemo, useState } from "react";
import { GROUP_COLOR, shortBrandName, formatKRWCompact } from "@/lib/sales/format";
import type { BrandRecord } from "@/lib/sales/csvData";

type SortKey = "revenue_current" | "revenue_prev" | "revenue_growth" | "profit_current" | "profit_growth";
type SortDir = "asc" | "desc";

interface Props {
  brands: BrandRecord[];
}

export default function BrandComparisonTable({ brands }: Props) {
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("revenue_current");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    brands.forEach((b) => {
      if (!map.has(b.groupCode)) map.set(b.groupCode, { code: b.groupCode, name: b.groupName });
    });
    return [...map.values()];
  }, [brands]);

  const filtered = useMemo(() => {
    let list = brands;
    if (groupFilter) list = list.filter((b) => b.groupCode === groupFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const av = (a.summary[sortKey] ?? -Infinity) as number;
      const bv = (b.summary[sortKey] ?? -Infinity) as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [brands, groupFilter, sortKey, sortDir, search]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="brutal bg-white overflow-hidden">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b-[2px] border-[#0a0a0a] bg-[#FAF7EC]">
        <Chip active={!groupFilter} onClick={() => setGroupFilter(null)}>
          전체 {brands.length}
        </Chip>
        {groups.map((g) => {
          const count = brands.filter((b) => b.groupCode === g.code).length;
          const c = GROUP_COLOR[g.code];
          return (
            <Chip
              key={g.code}
              active={groupFilter === g.code}
              onClick={() => setGroupFilter(g.code)}
              activeBg={c?.hex}
            >
              {g.name} {count}
            </Chip>
          );
        })}
        <input
          type="search"
          placeholder="브랜드명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-8 w-56 border-[2px] border-[#0a0a0a] bg-white px-3 text-[12px] font-medium placeholder:text-[#0a0a0a]/40 shadow-[2px_2px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_0_#0a0a0a] transition-all"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#F1ECDB] border-b-[2px] border-[#0a0a0a]">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] w-12">#</th>
              <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a]">브랜드</th>
              <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a]">그룹</th>
              <Th onClick={() => toggleSort("revenue_current")} active={sortKey === "revenue_current"} dir={sortDir}>올해 매출</Th>
              <Th onClick={() => toggleSort("revenue_prev")} active={sortKey === "revenue_prev"} dir={sortDir}>작년 매출</Th>
              <Th onClick={() => toggleSort("revenue_growth")} active={sortKey === "revenue_growth"} dir={sortDir}>성장률</Th>
              <Th onClick={() => toggleSort("profit_current")} active={sortKey === "profit_current"} dir={sortDir}>매출이익</Th>
              <Th onClick={() => toggleSort("profit_growth")} active={sortKey === "profit_growth"} dir={sortDir}>이익 성장률</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[12px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">
                  조건에 맞는 브랜드가 없습니다
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((b, i) => {
                const c = GROUP_COLOR[b.groupCode];
                const growth = b.summary.revenue_growth;
                const isPositive = (growth ?? 0) >= 0;
                const profitGrowth = b.summary.profit_growth;
                const profitPositive = (profitGrowth ?? 0) >= 0;
                const zebra = i % 2 === 1 ? "bg-[#FAF7EC]/40" : "bg-white";
                return (
                  <tr key={`${b.groupCode}-${b.code}`} className={`border-b border-[#0a0a0a]/10 ${zebra} hover:bg-yellow-100`}>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#0a0a0a]/55 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-extrabold text-[#0a0a0a]">{shortBrandName(b.name, 24)}</div>
                      <div className="text-[10px] font-mono text-[#0a0a0a]/55">{b.code}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[9.5px] font-extrabold uppercase tracking-wider text-white"
                        style={{ background: c?.hex ?? "#94a3b8" }}
                      >
                        {b.groupName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-extrabold text-[#0a0a0a]">
                      {formatKRWCompact(b.summary.revenue_current)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#0a0a0a]/55">
                      {formatKRWCompact(b.summary.revenue_prev)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono tabular-nums font-extrabold ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                      {growth !== null ? `${isPositive ? "▲" : "▼"} ${Math.abs(growth).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#0a0a0a]">
                      {formatKRWCompact(b.summary.profit_current)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono tabular-nums font-extrabold ${profitPositive ? "text-emerald-700" : "text-rose-600"}`}>
                      {profitGrowth !== null ? `${profitPositive ? "▲" : "▼"} ${Math.abs(profitGrowth).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 100 && (
        <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a]/55 border-t-[2px] border-[#0a0a0a] bg-[#FAF7EC]">
          상위 100개 표시 · 검색어/필터로 좁혀보세요 <span className="font-mono">(전체 {filtered.length})</span>
        </p>
      )}
    </div>
  );
}

function Chip({
  active, onClick, activeBg, children,
}: {
  active: boolean;
  onClick: () => void;
  activeBg?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] transition-all ${
        active
          ? "text-white shadow-[2px_2px_0_0_#0a0a0a]"
          : "bg-white text-[#0a0a0a] hover:bg-yellow-300"
      }`}
      style={active ? { backgroundColor: activeBg ?? "#0a0a0a" } : undefined}
    >
      {children}
    </button>
  );
}

function Th({
  active, dir, onClick, children,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-[.12em] cursor-pointer select-none ${
        active ? "text-[#0a0a0a] bg-yellow-200" : "text-[#0a0a0a]"
      } hover:bg-yellow-100 transition-colors`}
    >
      <span>{children}</span>
      {active && <span className="ml-1 font-mono">{dir === "desc" ? "▼" : "▲"}</span>}
    </th>
  );
}
