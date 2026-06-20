import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import { getLivingPopups } from "@/lib/livingPopupData";
import { buildWeeks } from "@/lib/livingPopup";
import LivingClient from "./_components/LivingClient";

export const metadata: Metadata = { title: "리빙 주제전 — lifestyle" };

export default async function LivingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  const orgId: string | null = membership?.organization_id ?? null;
  const role = (membership?.role as "owner" | "admin" | "member" | undefined) ?? null;
  const canEdit = role === "owner" || role === "admin";

  const year = new Date().getFullYear();   // 현재 연도 자동 (2027 되면 자동 전환)
  const popups = orgId ? await getLivingPopups(orgId, year, canEdit) : [];
  const weeks = buildWeeks(year);

  const done = popups.filter((p) => p.sales != null).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "리빙 주제전" }]} />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="LIVING POPUP"
            title="리빙 주제전"
            subtitle="브랜드 × 지점 × 주차 팝업 운영 캘린더. 셀을 눌러 일정을 추가·수정합니다. 계획·실행은 날짜로 자동."
            meta={`${year}년 · ${popups.length}건 · 실적입력 ${done}건`}
          />
          <LivingClient popups={popups} weeks={weeks} year={year} canEdit={canEdit} />
          <AppFooter />
        </div>
      </main>
    </div>
  );
}
