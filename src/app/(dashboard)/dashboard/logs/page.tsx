import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuditLogs, getAuditActors } from "@/lib/audit/queries";
import LogFilters from "./_components/LogFilters";
import LogTimeline from "./_components/LogTimeline";
import type { AuditFilters } from "@/types/audit";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "상권분석 — lifestyle" };

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
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "상권분석" }]} />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">상권분석</h1>
          <p className="mt-1 text-[13px] text-slate-400">목표 생성·수정·삭제·상태 변경이 자동으로 기록됩니다.</p>
        </div>
        {!orgId ? (
          <div className="rounded-xl bg-white py-16 text-center border border-[#e8ecf0]">
            <p className="text-sm text-slate-400">소속 조직이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-[#e8ecf0] bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
              <Suspense fallback={<div className="h-8 animate-pulse rounded-lg bg-slate-100" />}>
                <LogFilters actors={actors} />
              </Suspense>
            </div>
            <Suspense fallback={<TimelineSkeleton />}>
              <LogsContent orgId={orgId} filters={filters} />
            </Suspense>
          </>
        )}
      </main>
    </div>
  );
}
