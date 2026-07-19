import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SalesTabsShell from "./_components/SalesTabsShell";
import {
  getOnlineMeta, getOnlineMonth, getOnlineCumMeta, getOnlineCumulative,
  getOfflineMeta, getOfflineCum, getOfflineMonth, cumDays,
} from "@/lib/sales/queries";
import { getLifestyleMonthReport } from "@/lib/sales/lifestyleReport";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import DataFreshnessBadge from "@/components/ui/DataFreshnessBadge";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";

export const metadata: Metadata = { title: "매출분석 — lifestyle" };

/** 한 데이터셋 로드 실패가 페이지 전체를 죽이지 않도록 격리 (실패 시 null → 해당 탭만 빈 상태) */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { console.error("[sales] 데이터 로드 실패:", e); return null; }
}

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];

  // 각 데이터셋을 독립적으로 로드 — 하나가 실패해도 나머지 탭은 정상.
  const [online, onlineCum, offData, lifestyleReport] = await Promise.all([
    // 온라인(당월) — 최신 월 + 전년동월
    safe(async () => {
      const meta = await getOnlineMeta();
      if (!meta.hasData) return null;
      const ym = meta.yms[0];
      const prevYm = `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
      const o = await getOnlineMonth(ym, prevYm);
      return { ...o, ym: o.ym, prevYm: o.prevYm };
    }),
    // 온라인(누적) — 최신 연 + 전년 누적
    safe(async () => {
      const meta = await getOnlineCumMeta();
      if (!meta.hasData) return null;
      const year = meta.years[0];
      const prevYear = String(Number(year) - 1);
      const c = await getOnlineCumulative(year, prevYear);
      return { ...c, ym: `${year} 누적`, prevYm: `${prevYear} 누적` };
    }),
    // 오프라인 누적·당월 (온라인 부문 제외)
    safe(async () => {
      const offMeta = await getOfflineMeta();
      // 누적 마감월 = 누적 테이블에 저장된 through_ym 우선, 없으면 당월 최신 ym로 폴백.
      // 이렇게 하지 않으면 당월(7월)이 앞서 적재됐을 때 6월 누적을 7로 나누는 회귀가 남.
      const throughYm = offMeta.cumThroughYm ?? offMeta.monthYm;
      let offCum = null, offMonth = null;
      if (offMeta.cumYear) {
        const py = String(Number(offMeta.cumYear) - 1);
        const c = await getOfflineCum(offMeta.cumYear, py, OFFLINE_DIVISIONS, cumDays(offMeta.cumYear, throughYm));
        offCum = { ...c, periodLabel: `${offMeta.cumYear} 누적`, prevLabel: `${py} 누적` };
      }
      if (offMeta.monthYm) {
        const pym = `${Number(offMeta.monthYm.slice(0, 4)) - 1}${offMeta.monthYm.slice(4)}`;
        const m = await getOfflineMonth(offMeta.monthYm, pym, OFFLINE_DIVISIONS);
        offMonth = { ...m, periodLabel: offMeta.monthYm, prevLabel: pym };
      }
      return { offCum, offMonth, monthYm: offMeta.monthYm, cumYear: offMeta.cumYear, cumThroughYm: offMeta.cumThroughYm };
    }),
    // 라이프스타일 부문 리포트 (당월) — 성장 분해
    safe(() => getLifestyleMonthReport()),
  ]);

  const offCum = offData?.offCum ?? null;
  const offMonth = offData?.offMonth ?? null;
  const offMeta = { monthYm: offData?.monthYm ?? null, cumYear: offData?.cumYear ?? null, cumThroughYm: offData?.cumThroughYm ?? null };
  // 누적 개월수 — 누적 테이블의 through_ym(마감월)을 우선 사용. legacy 데이터는 monthYm 폴백.
  // 예: through_ym "2026-06" → 6개월로 나눠 월평균 계산.
  const cumMonths = (() => {
    const src = offMeta.cumThroughYm ?? offMeta.monthYm ?? "";
    const digits = src.replace(/[^0-9]/g, "");
    const m = Number(digits.slice(4, 6));
    return m >= 1 && m <= 12 ? m : 1;
  })();

  // 당월 활성 키 — 누적엔 매출 있지만 당월에 빠진(이탈) 건 판정용
  const monthActive = offMonth ? {
    brands: offMonth.brands.filter((b) => b.s > 0).map((b) => b.key),
    stores: offMonth.stores.filter((s) => s.s > 0).map((s) => s.key),
    detail: offMonth.detailBrands.filter((d) => d.s > 0).map((d) => `${d.division ?? ""}|${d.cat ?? ""}|${d.key}`),
  } : null;
  // 온라인 당월 활성 키 — 온라인 누적 탭의 이탈 판정용
  const onlineMonthActive = online ? {
    brands: online.brands.filter((b) => b.s > 0).map((b) => b.key),
    stores: online.stores.filter((s) => s.s > 0).map((s) => s.key),
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

        <SalesTabsShell online={online} onlineCum={onlineCum} offCum={offCum} offMonth={offMonth} monthActive={monthActive} onlineMonthActive={onlineMonthActive} cumMonths={cumMonths} lifestyleReport={lifestyleReport ?? null} />

          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
            Supabase 라이브 데이터 · 오프라인(특정) 누적{offMeta.cumYear ? ` ${offMeta.cumYear}` : ""}·당월{offMeta.monthYm ? ` ${offMeta.monthYm}` : ""} + 온라인 · 부문/복종/지점/브랜드 · 월 1회 갱신
          </p>

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
