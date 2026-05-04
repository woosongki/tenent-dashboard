import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getVendorFnb } from "@/lib/vendorFnb/queries";
import { getVendorLease } from "@/lib/vendorLease/queries";
import { getLastUpdatedMax } from "@/lib/dashboard/lastUpdated";
import type { PoolType } from "@/types/goals";
import VendorFnbTable from "./_components/VendorFnbTable";
import VendorStatusFunnel from "./_components/VendorStatusFunnel";
import VendorLeaseTable from "./_components/VendorLeaseTable";
import ContentPoolTabs from "./_components/ContentPoolTabs";
import PopupContactTable from "./_components/PopupContactTable";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
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

// ── 라이프스타일 탭 컨텐츠 (노션 일반임대 싱크) ─────────────
async function LifestyleContent() {
  const rows = await getVendorLease();
  return (
    <div className="space-y-5">
      <VendorLeaseTable rows={rows} />
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

  const lastUpdated = await getLastUpdatedMax(
    activeTab === "fnb" ? ["vendor_fnb"] : activeTab === "lifestyle" ? ["vendor_lease"] : ["goals"],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "컨텐츠 풀" }]}
        lastUpdated={lastUpdated}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="CONTENT POOL"
            title="컨텐츠 풀"
            subtitle="라이프스타일 · F&B · 팝업 컨텍판 — 셀 클릭으로 즉시 수정합니다."
          />

          <ContentPoolTabs active={activeTab} />

          {activeTab === "popup" ? (
            <PopupContactContent orgId={orgId ?? null} />
          ) : activeTab === "fnb" ? (
            <Suspense key="fnb" fallback={<GoalsTableSkeleton />}>
              <VendorFnbContent />
            </Suspense>
          ) : (
            <Suspense key="lifestyle" fallback={<GoalsTableSkeleton />}>
              <LifestyleContent />
            </Suspense>
          )}

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
