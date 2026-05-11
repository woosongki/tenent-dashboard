import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllStores } from "@/lib/stores";
import { getAllFloorplansGrouped } from "@/lib/floorplans/queries";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import FloorplansBrowser from "./_components/FloorplansBrowser";

export const metadata: Metadata = { title: "전점도면 — lifestyle" };
export const dynamic = "force-dynamic";

// 브랜드별 brutalist 컬러
const BRAND_COLOR: Record<string, { bg: string; text: string; hex: string }> = {
  "NC백화점":    { bg: "bg-violet-500",   text: "text-white",        hex: "#8b5cf6" },
  "뉴코아아울렛": { bg: "bg-rose-500",     text: "text-white",        hex: "#f43f5e" },
  "2001아울렛":  { bg: "bg-emerald-400",  text: "text-emerald-950",  hex: "#10b981" },
  "동아백화점":  { bg: "bg-cyan-400",     text: "text-cyan-950",     hex: "#0ea5e9" },
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
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="FLOORPLANS"
            title="전점도면"
            subtitle="지점별 층별 도면을 직접 업로드 · 관리합니다. 같은 층 재업로드 시 자동 교체됩니다."
            meta={`${totalStores}개 점포 · ${totalFloorplans}장`}
          />

          {/* KPI 3종 */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Stat label="전체 점포"      value={totalStores}      unit="개" accent="paper"   />
            <Stat label="도면 등록 점포" value={storesWithFloors} unit={`/ ${totalStores}`} caption={`${pct}% 등록률`} accent="violet" />
            <Stat label="총 층 도면"     value={totalFloorplans}  unit="장" accent="emerald" />
          </div>

          {/* 검색 + 브랜드별 섹션 (클라이언트 인터랙션) */}
          <FloorplansBrowser
            stores={stores}
            grouped={grouped}
            brandOrder={BRAND_ORDER}
            brandColor={BRAND_COLOR}
          />

          <AppFooter />
        </div>
      </main>
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  violet:  "bg-violet-500 text-white",
  emerald: "bg-emerald-400 text-emerald-950",
  paper:   "bg-[#F1ECDB] text-[#0a0a0a]",
};

function Stat({
  label, value, unit, caption, accent,
}: {
  label: string;
  value: number;
  unit?: string;
  caption?: string;
  accent: "violet" | "emerald" | "paper";
}) {
  return (
    <div className="brutal bg-white p-5">
      <div className={`flex items-center justify-between px-3 py-2 border-[2px] border-[#0a0a0a] ${ACCENT_BG[accent]}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{label}</span>
      </div>
      <p className="mt-4 font-mono text-[40px] font-extrabold leading-none tabular-nums tracking-tight text-[#0a0a0a]">
        {value.toLocaleString()}
        {unit && <span className="ml-1 text-[14px] font-extrabold text-[#0a0a0a]/55 font-sans">{unit}</span>}
      </p>
      {caption && <p className="mt-2 text-[11px] font-medium text-[#0a0a0a]/65 leading-tight">{caption}</p>}
    </div>
  );
}
