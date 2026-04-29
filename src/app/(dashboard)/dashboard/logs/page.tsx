import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuditLogs, getAuditActors } from "@/lib/audit/queries";
import LogFilters from "./_components/LogFilters";
import LogTimeline from "./_components/LogTimeline";
import type { AuditFilters } from "@/types/audit";

export const metadata: Metadata = { title: "편집 이력 — Gana" };

// searchParams → AuditFilters 변환
function parseFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined);
  return {
    entityType: (str("entityType") as AuditFilters["entityType"]) ?? "all",
    action:     (str("action")     as AuditFilters["action"])     ?? "all",
    actorId:    str("actorId"),
    dateFrom:   str("dateFrom"),
    dateTo:     str("dateTo"),
    cursor:     str("cursor"),
  };
}

// ── 데이터 로딩 (Suspense 경계) ───────────────────────────────
async function LogsContent({
  orgId,
  filters,
}: {
  orgId: string;
  filters: AuditFilters;
}) {
  const { logs, hasMore, nextCursor } = await getAuditLogs(orgId, filters);

  return <LogTimeline logs={logs} hasMore={hasMore} nextCursor={nextCursor} />;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {[0, 1].map((g) => (
        <div key={g} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-3 py-2.5">
                <div className="h-9 w-9 shrink-0 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-24 rounded bg-gray-100" />
                    <div className="h-5 w-10 rounded-full bg-gray-100" />
                    <div className="h-3.5 w-32 rounded bg-gray-100" />
                  </div>
                  <div className="h-3 w-48 rounded bg-gray-100" />
                </div>
                <div className="h-3 w-10 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 첫 번째 소속 조직 조회
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgId = membership?.organization_id as string | undefined;

  const sp      = await searchParams;
  const filters = parseFilters(sp);

  // actors는 필터 드롭다운용 — 빠른 별도 쿼리
  const actors = orgId ? await getAuditActors(orgId) : [];

  // 현재 적용 중인 필터 수 계산
  const activeFilterCount = [
    filters.entityType !== "all" && filters.entityType,
    filters.action     !== "all" && filters.action,
    filters.actorId,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <span className="text-sm font-semibold text-gray-800">편집 이력</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
              {activeFilterCount}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-5 sm:px-6 sm:py-8 sm:space-y-6">
        {/* 타이틀 */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">편집 이력</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            목표 생성·수정·삭제·상태 변경이 자동으로 기록됩니다.
          </p>
        </div>

        {!orgId ? (
          <div className="rounded-2xl bg-white py-16 text-center ring-1 ring-gray-200">
            <p className="text-sm text-gray-400">소속 조직이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 필터 */}
            <div className="rounded-2xl bg-white px-4 py-3.5 ring-1 ring-gray-200">
              <Suspense fallback={<div className="h-8 animate-pulse rounded-lg bg-gray-100" />}>
                <LogFilters actors={actors} />
              </Suspense>
            </div>

            {/* 타임라인 */}
            <Suspense fallback={<TimelineSkeleton />}>
              <LogsContent orgId={orgId} filters={filters} />
            </Suspense>
          </>
        )}
      </main>
    </div>
  );
}
