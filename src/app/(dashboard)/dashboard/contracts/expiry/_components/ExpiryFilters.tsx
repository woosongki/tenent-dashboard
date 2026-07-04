import Link from "next/link";
import BrandSearch from "./BrandSearch";

type Band = number | "all";

interface Props {
  horizons: number[];
  bandCounts: Record<number, number>;
  allCount: number;
  stores: string[];
  types: string[];
  current: { days: Band; store?: string; type?: string; brand?: string };
}

function buildQuery(over: { days?: Band; store?: string | null; type?: string | null }, current: Props["current"]): string {
  const p = new URLSearchParams();
  const days = over.days ?? current.days;
  const store = over.store === null ? undefined : over.store ?? current.store;
  const type = over.type === null ? undefined : over.type ?? current.type;
  if (days === "all") p.set("days", "all");
  else if (days !== 60) p.set("days", String(days));
  if (store) p.set("store", store);
  if (type) p.set("type", type);
  if (current.brand) p.set("brand", current.brand); // 밴드/지점/형태 전환 시 브랜드 검색 유지
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export default function ExpiryFilters({ horizons, bandCounts, allCount, stores, types, current }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* 브랜드 검색 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-[#0a0a0a]/55">브랜드</span>
        <BrandSearch current={current} />
        {current.brand && (
          <span className="font-mono text-[11px] font-bold text-[#0a0a0a]/60">
            “{current.brand}” 검색 결과
          </span>
        )}
      </div>

      {/* Horizon 밴드 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-[#0a0a0a]/55">기간</span>
        {horizons.map((h) => {
          const active = current.days === h;
          const count = bandCounts[h] ?? 0;
          return (
            <Link
              key={h}
              href={`/dashboard/contracts/expiry${buildQuery({ days: h }, current)}`}
              className={`inline-flex items-center gap-1.5 border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[11.5px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all ${
                active
                  ? "bg-yellow-300"
                  : "bg-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              }`}
            >
              D-{h}
              <span className="font-mono text-[10px] text-[#0a0a0a]/55">({count})</span>
            </Link>
          );
        })}
        {/* 전체 — 만료 임박 외 모든 계약 */}
        <Link
          href={`/dashboard/contracts/expiry${buildQuery({ days: "all" }, current)}`}
          className={`inline-flex items-center gap-1.5 border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[11.5px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all ${
            current.days === "all"
              ? "bg-yellow-300"
              : "bg-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          }`}
        >
          전체
          <span className="font-mono text-[10px] text-[#0a0a0a]/55">({allCount})</span>
        </Link>
      </div>

      {/* 계약형태 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-[#0a0a0a]/55">계약형태</span>
        <Link
          href={`/dashboard/contracts/expiry${buildQuery({ type: null }, current)}`}
          className={`border-[2px] border-[#0a0a0a] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${
            !current.type ? "bg-[#0a0a0a] text-white" : "bg-white hover:bg-[#F1ECDB]"
          }`}
        >
          전체
        </Link>
        {types.map((t) => {
          const active = current.type === t;
          return (
            <Link
              key={t}
              href={`/dashboard/contracts/expiry${buildQuery({ type: t }, current)}`}
              className={`border-[2px] border-[#0a0a0a] px-2.5 py-1 text-[10.5px] font-bold ${
                active ? "bg-[#0a0a0a] text-white" : "bg-white hover:bg-[#F1ECDB]"
              }`}
            >
              {t}
            </Link>
          );
        })}
      </div>

      {/* 지점 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-[#0a0a0a]/55">지점</span>
        <Link
          href={`/dashboard/contracts/expiry${buildQuery({ store: null }, current)}`}
          className={`border-[2px] border-[#0a0a0a] px-2 py-0.5 text-[10.5px] font-bold ${
            !current.store ? "bg-[#0a0a0a] text-white" : "bg-white hover:bg-[#F1ECDB]"
          }`}
        >
          전체
        </Link>
        {stores.map((s) => {
          const active = current.store === s;
          return (
            <Link
              key={s}
              href={`/dashboard/contracts/expiry${buildQuery({ store: s }, current)}`}
              className={`border-[2px] border-[#0a0a0a] px-2 py-0.5 text-[10.5px] font-bold ${
                active ? "bg-[#0a0a0a] text-white" : "bg-white hover:bg-[#F1ECDB]"
              }`}
            >
              {s}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
