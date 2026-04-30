import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import { getAllStores, BRAND_BADGE, type StoreBrand } from "@/lib/stores";
import { getTradeAreaIndex, TRADE_AREA_BADGE } from "@/lib/tradeArea";

export const metadata: Metadata = { title: "상권분석 — lifestyle" };

const BRAND_ORDER: StoreBrand[] = ["NC백화점", "뉴코아아울렛", "2001아울렛", "동아백화점"];

export default async function BranchPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { brand: brandFilter } = await searchParams;
  const all = getAllStores();
  const stores = brandFilter
    ? all.filter((s) => s.brand === brandFilter)
    : all;

  // 상권 분석 인덱스 (storeId → 라벨/카운트)
  const taIndex = getTradeAreaIndex();
  const taMap = new Map(
    (taIndex?.stores ?? []).map((t) => [t.id, t]),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "상권분석" }]} />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">상권분석</h1>
            <span className="text-[13px] text-slate-400 tabular-nums">{stores.length}개 점포</span>
          </div>
          <p className="mt-1 text-[13px] text-slate-400">
            이랜드리테일 점포별 위치 · 주변 상권 · 상업용 부동산 실거래가
          </p>
        </div>

        {/* 브랜드 필터 칩 */}
        <nav className="flex flex-wrap gap-1.5">
          <FilterChip href="/dashboard/branch" active={!brandFilter}>
            전체 {all.length}
          </FilterChip>
          {BRAND_ORDER.map((b) => {
            const count = all.filter((s) => s.brand === b).length;
            return (
              <FilterChip
                key={b}
                href={`/dashboard/branch?brand=${encodeURIComponent(b)}`}
                active={brandFilter === b}
              >
                {b} {count}
              </FilterChip>
            );
          })}
        </nav>

        {/* 점포 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {stores.map((s) => {
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
      </main>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white border-[#e8ecf0] text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}
