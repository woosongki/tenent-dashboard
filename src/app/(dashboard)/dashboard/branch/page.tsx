import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import { getAllStores, type StoreBrand } from "@/lib/stores";
import { getTradeAreaIndex } from "@/lib/tradeArea";
import BranchBrowser from "./_components/BranchBrowser";

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
  const taItems = taIndex?.stores ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "상권분석" }]} />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="LOCATION INTELLIGENCE"
            title="상권 분석"
            subtitle="이랜드리테일 41개 점포의 위치 · 주변 상권 · 상업용 부동산 실거래가를 한 곳에서."
            meta={`${stores.length}개 점포`}
          />

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

        {/* 검색 + 점포 그리드 (클라이언트 인터랙션) */}
        <BranchBrowser stores={stores} taItems={taItems} />

          <AppFooter />
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
