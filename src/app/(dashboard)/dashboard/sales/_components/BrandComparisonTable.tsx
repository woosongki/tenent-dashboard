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
    <div className="rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)] overflow-hidden">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#f1f5f9]">
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
          type="text"
          placeholder="브랜드명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded-lg border border-[#e8ecf0] px-3 py-1.5 text-[12px] focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium w-12">#</th>
              <th className="px-4 py-2.5 text-left font-medium">브랜드</th>
              <th className="px-4 py-2.5 text-left font-medium">그룹</th>
              <Th onClick={() => toggleSort("revenue_current")} active={sortKey === "revenue_current"} dir={sortDir}>
                올해 매출
              </Th>
              <Th onClick={() => toggleSort("revenue_prev")} active={sortKey === "revenue_prev"} dir={sortDir}>
                작년 매출
              </Th>
              <Th onClick={() => toggleSort("revenue_growth")} active={sortKey === "revenue_growth"} dir={sortDir}>
                성장률
              </Th>
              <Th onClick={() => toggleSort("profit_current")} active={sortKey === "profit_current"} dir={sortDir}>
                매출이익
              </Th>
              <Th onClick={() => toggleSort("profit_growth")} active={sortKey === "profit_growth"} dir={sortDir}>
                이익 성장률
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[12px] text-slate-400">
                  조건에 맞는 브랜드가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((b, i) => {
                const c = GROUP_COLOR[b.groupCode];
                const growth = b.summary.revenue_growth;
                const isPositive = (growth ?? 0) >= 0;
                const profitGrowth = b.summary.profit_growth;
                const profitPositive = (profitGrowth ?? 0) >= 0;
                return (
                  <tr key={`${b.groupCode}-${b.code}`} className="hover:bg-[#fafaff]">
                    <td className="px-4 py-2.5 text-[11px] text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-700">{shortBrandName(b.name, 24)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{b.code}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded ${c?.bg ?? "bg-slate-50"} ${c?.text ?? "text-slate-600"}`}>
                        {b.groupName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {formatKRWCompact(b.summary.revenue_current)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      {formatKRWCompact(b.summary.revenue_prev)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${isPositive ? "text-emerald-600" : "text-rose-500"}`}>
                      {growth !== null ? `${isPositive ? "▲" : "▼"} ${Math.abs(growth).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {formatKRWCompact(b.summary.profit_current)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${profitPositive ? "text-emerald-600" : "text-rose-500"}`}>
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
        <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-[#f1f5f9]">
          상위 100개 표시 · 검색어/필터로 좁혀보세요 (전체 {filtered.length}개)
        </p>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  activeBg,
  children,
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
      className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${
        active
          ? "text-white border-transparent"
          : "bg-white border-[#e8ecf0] text-slate-600 hover:bg-slate-50"
      }`}
      style={active ? { backgroundColor: activeBg ?? "#0f172a" } : undefined}
    >
      {children}
    </button>
  );
}

function Th({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-2.5 text-right font-medium cursor-pointer select-none ${
        active ? "text-slate-900" : ""
      } hover:text-slate-700`}
    >
      <span>{children}</span>
      {active && <span className="ml-1">{dir === "desc" ? "▼" : "▲"}</span>}
    </th>
  );
}
