import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getChannel,
  getBrandSummariesByChannel,
  getBrandDailyStats,
  defaultDateRange,
} from "@/lib/drilldown/queries";
import { BrandTable } from "../_components/DrillTable";
import Breadcrumb from "../_components/Breadcrumb";
import MetricCards from "../_components/MetricCards";
import StackedBarChart from "../_components/StackedBarChart";
import ExportButton from "@/components/ui/ExportButton";
import type { ExcelColumn } from "@/lib/excel";

export const metadata: Metadata = { title: "브랜드 분석 — Gana" };

const BRAND_COLUMNS: ExcelColumn[] = [
  { header: "브랜드명",   key: "brandName",        width: 20 },
  { header: "세션",       key: "totalSessions",    width: 12 },
  { header: "전환",       key: "totalConversions", width: 12 },
  { header: "전환율(%)",  key: "conversionRate",   width: 12 },
  { header: "매출",       key: "totalRevenue",     width: 16 },
  { header: "광고비",     key: "totalAdSpend",     width: 16 },
  { header: "ROAS",       key: "roas",             width: 10, format: (v) => (v !== null ? Number(v) : "") },
  { header: "CPA",        key: "cpa",              width: 14, format: (v) => (v !== null ? Number(v) : "") },
];

async function BrandContent({
  orgId,
  channelId,
}: {
  orgId: string;
  channelId: string;
}) {
  const range = defaultDateRange();

  const [brands, dailyData] = await Promise.all([
    getBrandSummariesByChannel(orgId, channelId, range),
    getBrandDailyStats(orgId, channelId, range),
  ]);

  const totals = brands.reduce(
    (acc, b) => ({
      sessions:    acc.sessions    + b.totalSessions,
      conversions: acc.conversions + b.totalConversions,
      revenue:     acc.revenue     + b.totalRevenue,
      adSpend:     acc.adSpend     + b.totalAdSpend,
    }),
    { sessions: 0, conversions: 0, revenue: 0, adSpend: 0 },
  );

  const conversionRate = totals.sessions > 0
    ? Math.round((totals.conversions / totals.sessions) * 10000) / 100
    : 0;
  const roas = totals.adSpend > 0
    ? Math.round((totals.revenue / totals.adSpend) * 100) / 100
    : null;
  const cpa = totals.conversions > 0
    ? Math.round((totals.adSpend / totals.conversions) * 100) / 100
    : null;

  const excelRows = brands as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <StackedBarChart data={dailyData} />
      <MetricCards
        sessions={totals.sessions}
        conversions={totals.conversions}
        revenue={totals.revenue}
        adSpend={totals.adSpend}
        conversionRate={conversionRate}
        roas={roas}
        cpa={cpa}
      />
      <div className="flex justify-end">
        <ExportButton filename="브랜드_분석" columns={BRAND_COLUMNS} rows={excelRows} />
      </div>
      <BrandTable
        rows={brands}
        basePath={`/dashboard/drilldown/${channelId}`}
      />
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-[312px]  border border-gray-100 bg-white shadow-sm" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-16  bg-white border border-gray-100 shadow-sm" />
        ))}
      </div>
      <div className="flex justify-end">
        <div className="h-8 w-32 rounded-lg bg-gray-100" />
      </div>
      <div className=" border border-gray-100 bg-white shadow-sm overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b border-gray-50 px-4 py-3.5 last:border-0">
            <div className="h-4 w-28 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [membership, channel] = await Promise.all([
    supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single(),
    getChannel(channelId),
  ]);

  if (!channel) notFound();

  const orgId = membership.data?.organization_id;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/dashboard/drilldown" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <span className="text-sm font-semibold text-gray-800">채널 분석</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-5 sm:px-6 sm:py-8 sm:space-y-6">
        <div>
          <Breadcrumb
            crumbs={[
              { label: "채널 분석", href: "/dashboard/drilldown" },
              { label: channel.name },
            ]}
          />
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: channel.color }}
            />
            <h1 className="text-xl font-bold text-gray-900">{channel.name}</h1>
          </div>
          <p className="mt-0.5 text-sm text-gray-400">브랜드를 클릭하면 일별 데이터를 볼 수 있습니다.</p>
        </div>

        {!orgId ? (
          <div className=" bg-white py-16 text-center border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-400">소속 조직이 없습니다.</p>
          </div>
        ) : (
          <Suspense fallback={<ContentSkeleton />}>
            <BrandContent orgId={orgId} channelId={channelId} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
