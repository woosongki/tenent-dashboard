import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getChannelSummaries, defaultDateRange } from "@/lib/drilldown/queries";
import { CHANNEL_TYPE_LABELS } from "@/types/drilldown";
import { ChannelTable } from "./_components/DrillTable";
import Breadcrumb from "./_components/Breadcrumb";
import ExportButton from "@/components/ui/ExportButton";
import type { ExcelColumn } from "@/lib/excel";
import type { ChannelSummary } from "@/types/drilldown";

export const metadata: Metadata = { title: "채널 분석 — Gana" };

const CHANNEL_COLUMNS: ExcelColumn[] = [
  { header: "채널명",    key: "channelName",      width: 20 },
  { header: "유형",      key: "channelType",      width: 16, format: (v) => CHANNEL_TYPE_LABELS[v as keyof typeof CHANNEL_TYPE_LABELS] },
  { header: "세션",      key: "totalSessions",    width: 12 },
  { header: "전환",      key: "totalConversions", width: 12 },
  { header: "전환율(%)", key: "conversionRate",   width: 12 },
  { header: "매출",      key: "totalRevenue",     width: 16 },
  { header: "광고비",    key: "totalAdSpend",     width: 16 },
  { header: "ROAS",      key: "roas",             width: 10, format: (v) => (v !== null ? Number(v) : "") },
  { header: "CPA",       key: "cpa",              width: 14, format: (v) => (v !== null ? Number(v) : "") },
];

async function ChannelContent({ orgId }: { orgId: string }) {
  const range = defaultDateRange();
  const channels = await getChannelSummaries(orgId, range);

  const excelRows = channels as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportButton filename="채널_분석" columns={CHANNEL_COLUMNS} rows={excelRows} />
      </div>
      <ChannelTable rows={channels} basePath="/dashboard/drilldown" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex justify-end">
        <div className="h-8 w-32 rounded-lg bg-gray-100" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex gap-8">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-3 w-14 rounded bg-gray-100" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-8 border-b border-gray-50 px-4 py-3.5 last:border-0">
            <div className="h-4 w-28 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-4 w-12 rounded bg-gray-100" />
            <div className="h-4 w-14 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DrilldownPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgId = membership?.organization_id;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <span className="text-sm font-semibold text-gray-800">채널 분석</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-5 sm:px-6 sm:py-8 sm:space-y-6">
        <div>
          <Breadcrumb crumbs={[{ label: "채널 분석" }]} />
          <h1 className="mt-2 text-xl font-bold text-gray-900">채널별 성과</h1>
          <p className="mt-0.5 text-sm text-gray-400">채널을 클릭하면 브랜드별 상세 데이터를 볼 수 있습니다.</p>
        </div>

        {!orgId ? (
          <div className="rounded-xl bg-white py-16 text-center border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-400">소속 조직이 없습니다.</p>
          </div>
        ) : (
          <Suspense fallback={<TableSkeleton />}>
            <ChannelContent orgId={orgId} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
