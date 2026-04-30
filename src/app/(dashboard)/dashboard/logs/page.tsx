import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMarketPriceData } from "@/lib/marketPrice/queries";
import { getLastUpdated } from "@/lib/dashboard/lastUpdated";
import MarketPriceTable from "./_components/MarketPriceTable";
import MarketPriceCharts from "./_components/MarketPriceCharts";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "상권분석 — lifestyle" };

function TableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-lg bg-slate-100" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-3">
          <div className="flex gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-3 w-16 rounded bg-slate-100" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b border-[#f8fafc] px-4 py-3.5 last:border-0">
            <div className="h-4 w-36 rounded bg-slate-100" />
            <div className="h-4 w-20 rounded-full bg-slate-100" />
            <div className="h-4 w-12 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function MarketPriceContent() {
  const rows = await getMarketPriceData();
  return (
    <div className="space-y-5">
      {rows.length > 0 && <MarketPriceCharts rows={rows} />}
      <MarketPriceTable rows={rows} />
    </div>
  );
}

export default async function LogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lastUpdated = await getLastUpdated("market_price_data");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "상권분석" }]}
        lastUpdated={lastUpdated}
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">상권분석</h1>
          <p className="mt-1 text-[13px] text-slate-400">상가 임차 시세 데이터 · 뉴코아/NC/2001/동아 브랜드별 현황</p>
        </div>
        <Suspense fallback={<TableSkeleton />}>
          <MarketPriceContent />
        </Suspense>
      </main>
    </div>
  );
}
