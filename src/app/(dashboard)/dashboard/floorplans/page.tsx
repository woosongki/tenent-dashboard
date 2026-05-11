import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllStores } from "@/lib/stores";
import { getAllFloorplansGrouped } from "@/lib/floorplans/queries";
import TopBar from "@/components/layout/TopBar";
import FloorplansBrowser from "./_components/FloorplansBrowser";

export const metadata: Metadata = { title: "전점도면" };
export const dynamic = "force-dynamic";

const BRAND_COLOR: Record<string, { bg: string; text: string; hex: string }> = {
  "NC백화점":    { bg: "bg-violet-50",  text: "text-violet-700",  hex: "#8b5cf6" },
  "뉴코아아울렛": { bg: "bg-rose-50",    text: "text-rose-700",    hex: "#f43f5e" },
  "2001아울렛":  { bg: "bg-emerald-50", text: "text-emerald-700", hex: "#10b981" },
  "동아백화점":  { bg: "bg-sky-50",     text: "text-sky-700",     hex: "#0ea5e9" },
};
const BRAND_ORDER = ["NC백화점", "뉴코아아울렛", "2001아울렛", "동아백화점"];

export default async function FloorplansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stores  = getAllStores();
  const grouped = await getAllFloorplansGrouped();

  const totalStores       = stores.length;
  const storesWithFloors  = stores.filter((s) => (grouped[s.id]?.length ?? 0) > 0).length;
  const totalFloorplans   = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
  const pct = totalStores > 0 ? Math.round((storesWithFloors / totalStores) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "전점도면" }]}
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">전점도면</h1>
            <p className="mt-1 text-[13px] text-slate-400">
              지점별 층별 도면을 직접 업로드 · 관리 — 같은 층 재업로드 시 자동 교체
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatPill label="전체 점포" value={totalStores} sub="개" />
            <StatPill label="도면 등록 점포" value={storesWithFloors} sub={`/ ${totalStores} (${pct}%)`} accent="text-violet-600" />
            <StatPill label="총 층 도면" value={totalFloorplans} sub="장" accent="text-emerald-600" />
          </div>
        </div>

        {/* 검색 + 브랜드별 섹션 (클라이언트 인터랙션) */}
        <FloorplansBrowser
          stores={stores}
          grouped={grouped}
          brandOrder={BRAND_ORDER}
          brandColor={BRAND_COLOR}
        />
      </main>
    </div>
  );
}

function StatPill({
  label,
  value,
  sub,
  accent = "text-slate-800",
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e8ecf0] bg-white px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-[15px] font-bold tabular-nums ${accent}`}>
        {value}
        {sub && <span className="ml-1 text-[10px] font-medium text-slate-400">{sub}</span>}
      </p>
    </div>
  );
}
