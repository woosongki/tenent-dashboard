import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getSalesMeta,
  getOverallTotal,
  getMonthSummary,
  getGroups,
  getStores,
  getBrands,
} from "@/lib/sales/csvData";
import MonthlyComparisonChart from "./_components/MonthlyComparisonChart";
import SalesSummaryCards from "./_components/SalesSummaryCards";
import GroupComparisonTable from "./_components/GroupComparisonTable";
import StoreComparisonTable from "./_components/StoreComparisonTable";
import BrandComparisonTable from "./_components/BrandComparisonTable";
import SalesTabsShell from "./_components/SalesTabsShell";
import {
  getOnlineMeta, getOnlineMonth, getOnlineCumMeta, getOnlineCumulative,
  getOfflineMeta, getOfflineCum, getOfflineMonth,
} from "@/lib/sales/queries";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";

export const metadata: Metadata = { title: "매출분석 — lifestyle" };

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = getSalesMeta();
  const overall = getOverallTotal();
  const monthly = getMonthSummary();
  const groups = getGroups();
  const stores = getStores();
  const brands = getBrands();

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

  // 오프라인 매출 (5번 누적 / 6번 당월)
  const offMeta = await getOfflineMeta();
  let offCum = null, offMonth = null;
  if (offMeta.cumYear) {
    const py = String(Number(offMeta.cumYear) - 1);
    const c = await getOfflineCum(offMeta.cumYear, py);
    offCum = { ...c, periodLabel: `${offMeta.cumYear} 누적`, prevLabel: `${py} 누적` };
  }
  if (offMeta.monthYm) {
    const pym = `${Number(offMeta.monthYm.slice(0, 4)) - 1}${offMeta.monthYm.slice(4)}`;
    const m = await getOfflineMonth(offMeta.monthYm, pym);
    offMonth = { ...m, periodLabel: offMeta.monthYm, prevLabel: pym };
  }

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
            subtitle="26년 1~5월 누적 · 구매그룹 · 지점 · 브랜드 3축"
            meta={`${meta.period1} vs ${meta.period2} · 지점 ${stores.length}개 · 브랜드 ${brands.length}개`}
          />

        <SalesTabsShell online={online} onlineCum={onlineCum} offCum={offCum} offMonth={offMonth}>
          {/* ── 매출 요약 탭 (기존 오프라인 콘텐츠) ── */}
          <div className="space-y-6">
            <SalesSummaryCards overall={overall} monthly={monthly} />
            <MonthlyComparisonChart monthly={monthly} />

            <section className="space-y-3">
              <div className="inline-block border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1 shadow-[2px_2px_0_0_#0a0a0a]">
                <h2 className="font-display text-[18px] leading-none text-[#0a0a0a]">구매그룹별 매출</h2>
              </div>
              <GroupComparisonTable groups={groups} />
            </section>

            <section className="space-y-3">
              <div className="inline-flex items-center gap-2 border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1 shadow-[2px_2px_0_0_#0a0a0a]">
                <h2 className="font-display text-[18px] leading-none text-[#0a0a0a]">지점별 매출</h2>
                <span className="font-mono text-[12px] font-extrabold tabular-nums text-[#0a0a0a]">{stores.length}</span>
              </div>
              <p className="text-[11px] font-bold text-[#0a0a0a]/45">지점 행을 클릭하면 입점 브랜드 매출 TOP을 펼쳐봅니다.</p>
              <StoreComparisonTable stores={stores} />
            </section>

            <section className="space-y-3">
              <div className="inline-flex items-center gap-2 border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1 shadow-[2px_2px_0_0_#0a0a0a]">
                <h2 className="font-display text-[18px] leading-none text-[#0a0a0a]">브랜드별 매출</h2>
                <span className="font-mono text-[12px] font-extrabold tabular-nums text-[#0a0a0a]">{brands.length}</span>
              </div>
              <BrandComparisonTable brands={brands} />
            </section>
          </div>
        </SalesTabsShell>

          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
            데이터 출처 <span className="font-mono">{meta.compiledAt}</span> 변환 · 26년 1~5월 누적 실적 (구매그룹·브랜드 / 지점·브랜드) · 41개점 기준
          </p>

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
