import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import DataFreshnessBadge from "@/components/ui/DataFreshnessBadge";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import { getOfflineMeta, getBcdCum, getBcdMonth, cumDays } from "@/lib/sales/queries";
import BcdClient from "./_components/BcdClient";

export const metadata: Metadata = { title: "BCD 분석 — lifestyle" };

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { console.error("[bcd] 로드 실패:", e); return null; }
}

export default async function BcdPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members").select("role").eq("user_id", user.id).limit(1).maybeSingle();
  const role = membership?.role as "owner" | "admin" | "member" | undefined;
  const canEdit = role === "owner" || role === "admin";

  const data = await safe(async () => {
    const meta = await getOfflineMeta();
    let cum = null, month = null;
    if (meta.cumYear) {
      const py = String(Number(meta.cumYear) - 1);
      const throughYm = meta.cumThroughYm ?? meta.monthYm;
      cum = await getBcdCum(meta.cumYear, py, cumDays(meta.cumYear, throughYm));
    }
    if (meta.monthYm) {
      const pym = `${Number(meta.monthYm.slice(0, 4)) - 1}${meta.monthYm.slice(4)}`;
      month = await getBcdMonth(meta.monthYm, pym);
    }
    return { cum, month, monthYm: meta.monthYm };
  });

  const cum = data?.cum ?? null;
  const month = data?.month ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "BCD 분석" }]} />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="BCD ANALYSIS"
            title="BCD 분석"
            subtitle="브랜드 등급(S/A/B/C/F) 기반 분석. BCD점수 = A+B등급 매장수 ÷ 전체 매장수. 부문·복종·지점별로 봅니다."
            meta={cum ? `BCD점수 ${cum.bcdScore}점 · 브랜드 ${cum.brands.length}개` : "데이터 없음"}
            action={<DataFreshnessBadge monthYm={data?.monthYm ?? null} />}
          />
          <BcdClient cum={cum} month={month} canEdit={canEdit} />
          <AppFooter />
        </div>
      </main>
    </div>
  );
}
