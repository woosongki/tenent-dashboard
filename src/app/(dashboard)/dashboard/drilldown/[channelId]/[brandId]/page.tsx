import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getChannel,
  getBrand,
  getDailyStats,
  defaultDateRange,
} from "@/lib/drilldown/queries";
import { DailyTable } from "../../_components/DrillTable";
import Breadcrumb from "../../_components/Breadcrumb";
import MetricCards from "../../_components/MetricCards";
import DailyLineChart from "../../_components/DailyLineChart";
import ExportButton from "@/components/ui/ExportButton";
import type { ExcelColumn } from "@/lib/excel";

export const metadata: Metadata = { title: "일별 분석 — Gana" };

const DAILY_COLUMNS: ExcelColumn[] = [
  { header: "날짜",       key: "statDate",       width: 14 },
  { header: "세션",       key: "sessions",       width: 12 },
  { header: "전환",       key: "conversions",    width: 12 },
  { header: "전환율(%)",  key: "conversionRate", width: 12 },
  { header: "매출",       key: "revenue",        width: 16 },
  { header: "광고비",     key: "adSpend",        width: 16 },
  { header: "ROAS",       key: "roas",           width: 10, format: (v) => (v !== null ? Number(v) : "") },
  { header: "CPA",        key: "cpa",            width: 14, format: (v) => (v !== null ? Number(v) : "") },
];

async function DailyContent({
  channelId,
  brandId,
  brandColor,
  brandName,
}: {
  channelId: string;
  brandId: string;
  brandColor: string;
  brandName: string;
}) {
  const range = defaultDateRange();
  const stats = await getDailyStats(channelId, brandId, range);

  const totals = stats.reduce(
    (acc, r) => ({
      sessions:    acc.sessions    + r.sessions,
      conversions: acc.conversions + r.conversions,
      revenue:     acc.revenue     + r.revenue,
      adSpend:     acc.adSpend     + r.adSpend,
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

  const excelRows = stats as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <DailyLineChart data={stats} brandColor={brandColor} />
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
        <ExportButton
          filename={`일별_분석_${brandName}`}
          columns={DAILY_COLUMNS}
          rows={excelRows}
        />
      </div>
      <DailyTable rows={stats} />
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b border-gray-50 px-4 py-3.5 last:border-0">
            <div className="h-4 w-24 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ channelId: string; brandId: string }>;
}) {
  const { channelId, brandId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [channel, brand] = await Promise.all([
    getChannel(channelId),
    getBrand(brandId),
  ]);

  if (!channel || !brand) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href={`/dashboard/drilldown/${channelId}`}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
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
              { label: "채널 분석",   href: "/dashboard/drilldown" },
              { label: channel.name, href: `/dashboard/drilldown/${channelId}` },
              { label: brand.name },
            ]}
          />
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: brand.color }}
            />
            <h1 className="text-xl font-bold text-gray-900">{brand.name}</h1>
            <span className="text-sm text-gray-400">in {channel.name}</span>
          </div>
          <p className="mt-0.5 text-sm text-gray-400">최근 30일 일별 성과 데이터입니다.</p>
        </div>

        <Suspense fallback={<ContentSkeleton />}>
          <DailyContent
            channelId={channelId}
            brandId={brandId}
            brandColor={brand.color}
            brandName={brand.name}
          />
        </Suspense>
      </main>
    </div>
  );
}
