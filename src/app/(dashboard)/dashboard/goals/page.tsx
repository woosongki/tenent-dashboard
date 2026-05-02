import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getGoals } from "@/lib/goals/queries";
import { getVendorFnb } from "@/lib/vendorFnb/queries";
import { getLastUpdatedMax } from "@/lib/dashboard/lastUpdated";
import type { PoolType } from "@/types/goals";
import GoalsTable from "./_components/GoalsTable";
import VendorFnbTable from "./_components/VendorFnbTable";
import VendorStatusFunnel from "./_components/VendorStatusFunnel";
import AddGoalForm from "./_components/AddGoalForm";
import ContentPoolTabs from "./_components/ContentPoolTabs";
import PopupContactTable from "./_components/PopupContactTable";
import TopBar from "@/components/layout/TopBar";
import { getPopupContacts, getPopupContactsMeta } from "@/lib/popupContacts";
import { getCalendarAssignments } from "@/lib/calendarAssignments";

export const metadata: Metadata = { title: "컨텐츠 풀 — lifestyle" };

const POOL_TYPES: PoolType[] = ["lifestyle", "fnb", "popup"];

function isPoolType(v: unknown): v is PoolType {
  return typeof v === "string" && POOL_TYPES.includes(v as PoolType);
}

// ── 스켈레톤 ──────────────────────────────────────────────────
function GoalsTableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-8 w-32 rounded-lg bg-slate-100" />
        <div className="h-8 w-28 rounded-lg bg-slate-100" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-3">
          <div className="flex gap-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-3 w-16 rounded bg-slate-100" />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b border-[#f8fafc] px-4 py-3.5 last:border-0">
            <div className="h-4 w-32 rounded bg-slate-100" />
            <div className="h-4 w-14 rounded-full bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-slate-100" />
            <div className="h-2 w-24 self-center rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 탭 카운트 로드 (서버) ──────────────────────────────────────
async function loadCounts(orgId: string): Promise<Record<PoolType, number>> {
  const all = await getGoals(orgId);
  return {
    lifestyle: all.filter((g) => g.poolType === "lifestyle").length,
    fnb:       all.filter((g) => g.poolType === "fnb").length,
    // 팝업 탭은 노션 컨텍판(정적 CSV) 기준으로 표시
    popup:     getPopupContacts().length,
  };
}

// ── 팝업 탭 전용 컨텐츠 (정적 CSV + 캘린더 핀 역참조) ───────────
async function PopupContactContent({ orgId }: { orgId: string | null }) {
  const rows = getPopupContacts();
  const meta = getPopupContactsMeta();
  // contactNo → 핀된 주차 인덱스 배열
  const pinsByContact: Record<number, number[]> = {};
  if (orgId) {
    const grouped = await getCalendarAssignments(orgId);
    for (const [weekIdx, arr] of Object.entries(grouped)) {
      for (const a of arr) {
        (pinsByContact[a.contactNo] ??= []).push(Number(weekIdx));
      }
    }
  }
  return <PopupContactTable rows={rows} importedAt={meta.importedAt} pinsByContact={pinsByContact} />;
}

// ── F&B 탭 전용 컨텐츠 (서버) ────────────────────────────────
async function VendorFnbContent() {
  const rows = await getVendorFnb();
  return (
    <div className="space-y-5">
      {rows.length > 0 && <VendorStatusFunnel rows={rows} />}
      <VendorFnbTable rows={rows} />
    </div>
  );
}

// ── 라이프스타일/팝업 탭 컨텐츠 (서버) ──────────────────────
async function GoalsContent({ orgId, poolType }: { orgId: string; poolType: PoolType }) {
  const goals = await getGoals(orgId, poolType);

  const total     = goals.length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const atRisk    = goals.filter((g) => g.status === "at_risk" || g.status === "behind").length;

  return (
    <div className="space-y-5">
      {total > 0 && (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <StatChip label="전체" value={total}                       color="text-slate-700"   />
          <StatChip label="진행" value={total - completed - atRisk}   color="text-blue-600"    />
          <StatChip label="주의" value={atRisk}                      color="text-amber-600"   />
          <StatChip label="달성" value={completed}                   color="text-emerald-600" />
        </div>
      )}
      <GoalsTable goals={goals} />
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GoalsPage({ searchParams }: PageProps) {
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

  const params   = await searchParams;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab: PoolType = isPoolType(tabParam) ? tabParam : "lifestyle";

  const counts = orgId
    ? await loadCounts(orgId)
    : { lifestyle: 0, fnb: 0, popup: 0 };

  const lastUpdated = await getLastUpdatedMax(
    activeTab === "fnb" ? ["vendor_fnb"] : ["goals"],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "컨텐츠 풀" }]}
        lastUpdated={lastUpdated}
        action={
          activeTab === "lifestyle" && orgId
            ? <AddGoalForm organizationId={orgId} poolType={activeTab} />
            : undefined
        }
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        {/* 제목 */}
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">컨텐츠 풀</h1>
          <p className="mt-1 text-[13px] text-slate-400">라이프스타일 · F&amp;B · 팝업 브랜드 후보를 관리합니다 · 셀 클릭으로 즉시 수정</p>
        </div>

        {/* 탭 */}
        <ContentPoolTabs active={activeTab} counts={counts} />

        {/* 컨텐츠 */}
        {activeTab === "popup" ? (
          <PopupContactContent orgId={orgId ?? null} />
        ) : activeTab === "fnb" ? (
          <Suspense key="fnb" fallback={<GoalsTableSkeleton />}>
            <VendorFnbContent />
          </Suspense>
        ) : !orgId ? (
          <div className="rounded-xl bg-white py-16 text-center border border-[#e8ecf0]">
            <p className="text-sm text-slate-400">소속 조직이 없습니다.</p>
          </div>
        ) : (
          <Suspense key={activeTab} fallback={<GoalsTableSkeleton />}>
            <GoalsContent orgId={orgId} poolType={activeTab} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function StatChip({
  label, value, color,
}: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-[#e8ecf0] bg-white px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
