"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OnlineMonthTab from "./OnlineMonthTab";
import OfflineTab from "./OfflineTab";
import OfflineDetailTab from "./OfflineDetailTab";
import LifestyleReportTab from "./LifestyleReportTab";
import type { OnlineRank, OffRank, OffOthers } from "@/lib/sales/queries";
import type { LifestyleReport } from "@/lib/sales/lifestyleReport";

interface OnlineProps {
  ym: string;
  prevYm: string;
  total: number;
  prevTotal: number;
  yoyPct: number;
  brands: OnlineRank[];
  stores: OnlineRank[];
  channels: { channel: string; s: number; ps: number; yoyPct: number }[];
  cats: { cat: string; s: number; ps: number; yoyPct: number }[];
}

// OfflineTab props 타입
interface OffProps {
  periodLabel: string; prevLabel: string;
  total: number; prevTotal: number; gTotal: number; gpm: number; yoyPct: number;
  brands: OffRank[]; stores: OffRank[]; detailBrands: OffRank[];
  divisions: { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }[];
  fashionCats: { cat: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }[];
  others?: OffOthers | null;
}

export interface MonthActive { brands: string[]; stores: string[]; detail: string[]; }

// 오프라인 월별 이력 — 누적탭 하위 서브탭용
export interface HistBundle {
  year: string;
  prevYear: string;
  throughMonth: number;
  months: string[];                   // ['2026-01', ..., '2026-07']
  cum: OffProps;                      // YTD 1~throughMonth
  byMonth: Record<string, OffProps>;  // ym → 단일 월
  availableYears: string[];           // 스위처 후보
}

interface Props {
  offCum: OffProps | null;        // 오프라인 누적 (5번, legacy)
  offMonth: OffProps | null;      // 오프라인 당월 (6번)
  online: OnlineProps | null;     // 온라인 당월 (9번)
  onlineCum: OnlineProps | null;  // 온라인 누적 (8번)
  monthActive: MonthActive | null;  // 오프라인 당월 활성 키 (이탈 판정)
  onlineMonthActive: { brands: string[]; stores: string[] } | null;  // 온라인 당월 활성 키
  cumMonths: number;              // 누적 개월수 (예: "2026-06" → 6) — 누적상세 월평균 계산용
  lifestyleMonth: LifestyleReport | null;  // 라이프스타일 부문 리포트 (당월)
  lifestyleCum: LifestyleReport | null;    // 라이프스타일 부문 리포트 (누적)
  hist: HistBundle | null;        // 오프라인 월별 이력 (신규)
}

type TabKey = "off-cum" | "off-cum-detail" | "off-month" | "off-month-detail" | "life-month" | "online-cum" | "online-month";
type MonthTab = "cum" | string; // "cum" or ym string like "2026-07"

export default function SalesTabsShell({ offCum, offMonth, online, onlineCum, monthActive, onlineMonthActive, cumMonths, lifestyleMonth, lifestyleCum, hist }: Props) {
  const [tab, setTab] = useState<TabKey>("off-cum");
  // 누적탭 서브탭 — 기본 '누적'. hist 없으면 legacy offCum 로 폴백.
  const [monthTab, setMonthTab] = useState<MonthTab>("cum");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const currentYear = hist?.year ?? "";

  function changeYear(y: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("histYear", y);
    setMonthTab("cum");
    startTransition(() => router.push(`?${sp.toString()}`, { scroll: false }));
  }

  // 누적탭에서 실제 렌더할 OffProps 선택. hist 있으면 서브탭에 따라 cum / byMonth.
  const activeCum: OffProps | null = hist
    ? (monthTab === "cum" ? hist.cum : hist.byMonth[monthTab] ?? hist.cum)
    : offCum;

  return (
    <div className="space-y-4">
      {/* 탭 바 */}
      <div className="flex gap-1.5 overflow-x-auto border-b-[2px] border-[#0a0a0a] pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabBtn active={tab === "off-cum"} onClick={() => setTab("off-cum")}>
          🏆 누적{activeCum ? ` · ${activeCum.periodLabel}` : ""}
        </TabBtn>
        <TabBtn active={tab === "off-cum-detail"} onClick={() => setTab("off-cum-detail")}>
          🔎 누적상세
        </TabBtn>
        <TabBtn active={tab === "off-month"} onClick={() => setTab("off-month")}>
          📅 당월{offMonth ? ` · ${offMonth.periodLabel}` : ""}
        </TabBtn>
        <TabBtn active={tab === "off-month-detail"} onClick={() => setTab("off-month-detail")}>
          🔎 당월상세
        </TabBtn>
        <TabBtn active={tab === "life-month"} onClick={() => setTab("life-month")}>
          🛋 라이프스타일 리포트
        </TabBtn>
        <TabBtn active={tab === "online-cum"} onClick={() => setTab("online-cum")}>
          🛒 온라인(누적){onlineCum ? ` · ${onlineCum.ym}` : ""}
        </TabBtn>
        <TabBtn active={tab === "online-month"} onClick={() => setTab("online-month")}>
          📱 온라인(당월){online ? ` · ${online.ym}` : ""}
        </TabBtn>
      </div>

      {/* 누적탭 서브탭 (연도 스위처 + 월별 이력) */}
      {tab === "off-cum" && hist && (
        <div className="flex flex-wrap items-center gap-2">
          {hist.availableYears.length > 1 && (
            <div className="flex items-center gap-1 border-[2px] border-[#0a0a0a] bg-white p-0.5">
              <span className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/60">연도</span>
              {hist.availableYears.map((y) => (
                <button
                  key={y}
                  disabled={pending}
                  onClick={() => changeYear(y)}
                  className={`px-2.5 py-1 text-[12px] font-extrabold transition ${y === currentYear ? "bg-yellow-300 text-[#0a0a0a]" : "text-[#0a0a0a]/60 hover:text-[#0a0a0a]"}`}
                >
                  {y.slice(2)}년
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1 border-[2px] border-[#0a0a0a] bg-white p-0.5">
            {hist.months.map((ym) => (
              <button
                key={ym}
                onClick={() => setMonthTab(ym)}
                className={`px-2.5 py-1 text-[12px] font-extrabold transition ${monthTab === ym ? "bg-yellow-300 text-[#0a0a0a]" : "text-[#0a0a0a]/60 hover:text-[#0a0a0a]"}`}
              >
                {Number(ym.slice(5, 7))}월
              </button>
            ))}
            <button
              onClick={() => setMonthTab("cum")}
              className={`px-2.5 py-1 text-[12px] font-extrabold transition ${monthTab === "cum" ? "bg-yellow-300 text-[#0a0a0a]" : "text-[#0a0a0a]/60 hover:text-[#0a0a0a]"}`}
            >
              누적
            </button>
          </div>
          {pending && <span className="text-[11px] font-bold text-[#0a0a0a]/50">전환 중…</span>}
        </div>
      )}

      {/* 탭 내용 */}
      {tab === "off-cum" && (activeCum ? <OfflineTab {...activeCum} monthActive={monthTab === "cum" ? monthActive : null} /> : <Empty table="sales_offline_monthly_hist" />)}
      {tab === "off-cum-detail" && (offCum ? <OfflineDetailTab periodLabel={offCum.periodLabel} prevLabel={offCum.prevLabel} brands={offCum.detailBrands} stores={offCum.stores} divisions={offCum.divisions} fashionCats={offCum.fashionCats} others={offCum.others} monthActive={monthActive} monthCount={cumMonths} /> : <Empty table="sales_offline_cum" />)}
      {tab === "off-month" && (offMonth ? <OfflineTab {...offMonth} /> : <Empty table="sales_offline_month" />)}
      {tab === "off-month-detail" && (offMonth ? <OfflineDetailTab periodLabel={offMonth.periodLabel} prevLabel={offMonth.prevLabel} brands={offMonth.detailBrands} stores={offMonth.stores} divisions={offMonth.divisions} fashionCats={offMonth.fashionCats} others={offMonth.others} /> : <Empty table="sales_offline_month" />)}
      {tab === "life-month" && <LifestyleReportTab month={lifestyleMonth} cum={lifestyleCum} />}
      {tab === "online-cum" && (onlineCum ? <OnlineMonthTab {...onlineCum} periodLabel="온라인 누적" monthActive={onlineMonthActive} /> : <Empty table="sales_online_cum" />)}
      {tab === "online-month" && (online ? <OnlineMonthTab {...online} /> : <Empty table="sales_online_monthly" />)}
    </div>
  );
}

function Empty({ table }: { table: string }) {
  return (
    <div className="border-[2px] border-dashed border-slate-300 p-10 text-center text-[13px] text-slate-400">
      데이터가 없습니다. <code className="text-[11px]">{table}</code> 테이블에 CSV를 import 하세요.
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap border-[2px] border-b-0 px-3 py-2 text-[12px] font-bold transition sm:px-4 sm:text-[13px] ${
        active
          ? "border-[#0a0a0a] bg-yellow-300 text-[#0a0a0a]"
          : "border-transparent bg-transparent text-slate-400 hover:text-[#0a0a0a]"
      }`}
    >
      {children}
    </button>
  );
}
