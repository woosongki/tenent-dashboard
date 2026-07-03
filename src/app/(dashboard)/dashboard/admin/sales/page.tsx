import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import SalesIngestClient from "./_components/SalesIngestClient";

export const metadata: Metadata = { title: "매출 데이터 갱신 — lifestyle" };

export default async function AdminSalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 관리자(owner/admin)만 — admin/users 와 동일한 게이트
  const { data: me } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "관리" }, { label: "매출 데이터 갱신" }]} />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="SALES DATA REFRESH"
            title="매출 데이터 갱신"
            subtitle="ERP 익스포트 4개(5·6·8·9번)를 올려 매출분석 데이터를 통째로 교체합니다. 로컬 스크립트 없이 브라우저에서 바로 반영."
          />
          <SalesIngestClient />
          <AppFooter />
        </div>
      </main>
    </div>
  );
}
