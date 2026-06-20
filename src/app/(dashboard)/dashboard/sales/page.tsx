import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SalesTabsShell from "./_components/SalesTabsShell";
import {
  getOnlineMeta, getOnlineMonth, getOnlineCumMeta, getOnlineCumulative,
  getOfflineMeta, getOfflineCum, getOfflineMonth, cumDays,
} from "@/lib/sales/queries";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import DataFreshnessBadge from "@/components/ui/DataFreshnessBadge";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";

export const metadata: Metadata = { title: "매출분석 — lifestyle" };

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 온라인(당월) — 가장 최근 월 + 전년동월 자동 선택
  const onlineMeta = await getOnlineMeta();
  let online = null;
  if (onlineMeta.hasData) {
    const ym = onlineMeta.yms[0];                   // 최신 월 (예: 2026-06)
    const prevYm = `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;  // 전년동월
    const o = await getOnlineMonth(ym, prevYm);
    online = { ...o, ym: o.ym, prevYm: o.prevYm };
  }

  // 온라인(누적) — 최신 연도 + 전년 누적
  const cumMeta = await getOnlineCumMeta();
  let onlineCum = null;
  if (cumMeta.hasData) {
    const year = cumMeta.years[0];                  // 최신 연 (예: 2026)
    const prevYear = String(Number(year) - 1);
    const c = await getOnlineCumulative(year, prevYear);
    // OnlineMonthTab은 ym/prevYm 라벨을 받으므로 연 누적 라벨로 매핑
    onlineCum = { ...c, ym: `${year} 누적`, prevYm: `${prevYear} 누적` };
  }

  // 오프라인 매출 (5번 누적 / 6번 당월) — 온라인(I*) 부문 제외, 별도 온라인 탭에서 노출.
  const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];
  const offMeta = await getOfflineMeta();
  let offCum = null, offMonth = null;
  if (offMeta.cumYear) {
    const py = String(Number(offMeta.cumYear) - 1);
    const c = await getOfflineCum(offMeta.cumYear, py, OFFLINE_DIVISIONS, cumDays(offMeta.cumYear, offMeta.monthYm));
    offCum = { ...c, periodLabel: `${offMeta.cumYear} 누적`, prevLabel: `${py} 누적` };
  }
  if (offMeta.monthYm) {
    const pym = `${Number(offMeta.monthYm.slice(0, 4)) - 1}${offMeta.monthYm.slice(4)}`;
    const m = await getOfflineMonth(offMeta.monthYm, pym, OFFLINE_DIVISIONS);
    offMonth = { ...m, periodLabel: offMeta.monthYm, prevLabel: pym };
  }

  // 당월 활성 키 — 누적엔 매출 있지만 당월에 빠진(이탈) 건 판정용
  const monthActive = offMonth ? {
    brands: offMonth.brands.filter((b) => b.s > 0).map((b) => b.key),
    stores: offMonth.stores.filter((s) => s.s > 0).map((s) => s.key),
    detail: offMonth.detailBrands.filter((d) => d.s > 0).map((d) => `${d.division ?? ""}|${d.cat ?? ""}|${d.key}`),
  } : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "매출분석" }]}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="SALES ANALYTICS"
            title="매출분석"
            subtitle="오프라인·온라인 실적을 부문·복종·지점·브랜드로 분석. 신규·퇴점·이탈 자동 표시."
            meta={offCum ? `누적 ${offCum.year} · 지점 ${offCum.stores.length}개 · 브랜드 ${offCum.brands.length}개` : "데이터 없음"}
            action={<DataFreshnessBadge monthYm={offMeta.monthYm} />}
          />

        <SalesTabsShell online={online} onlineCum={onlineCum} offCum={offCum} offMonth={offMonth} monthActive={monthActive} />

          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
            Supabase 라이브 데이터 · 오프라인(특정) 누적{offMeta.cumYear ? ` ${offMeta.cumYear}` : ""}·당월{offMeta.monthYm ? ` ${offMeta.monthYm}` : ""} + 온라인 · 부문/복종/지점/브랜드 · 월 1회 갱신
          </p>

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
