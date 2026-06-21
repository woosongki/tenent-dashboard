"use client";

import { useState } from "react";
import OnlineMonthTab from "./OnlineMonthTab";
import OfflineTab from "./OfflineTab";
import OfflineDetailTab from "./OfflineDetailTab";
import type { OnlineRank, OffRank, OffOthers } from "@/lib/sales/queries";

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

interface Props {
  offCum: OffProps | null;        // 오프라인 누적 (5번)
  offMonth: OffProps | null;      // 오프라인 당월 (6번)
  online: OnlineProps | null;     // 온라인 당월 (9번)
  onlineCum: OnlineProps | null;  // 온라인 누적 (8번)
  monthActive: MonthActive | null;  // 오프라인 당월 활성 키 (이탈 판정)
  onlineMonthActive: { brands: string[]; stores: string[] } | null;  // 온라인 당월 활성 키
}

type TabKey = "off-cum" | "off-cum-detail" | "off-month" | "off-month-detail" | "online-cum" | "online-month";

export default function SalesTabsShell({ offCum, offMonth, online, onlineCum, monthActive, onlineMonthActive }: Props) {
  const [tab, setTab] = useState<TabKey>("off-cum");

  return (
    <div className="space-y-4">
      {/* 탭 바 */}
      <div className="flex gap-1.5 overflow-x-auto border-b-[2px] border-[#0a0a0a] pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabBtn active={tab === "off-cum"} onClick={() => setTab("off-cum")}>
          🏆 누적{offCum ? ` · ${offCum.periodLabel}` : ""}
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
        <TabBtn active={tab === "online-cum"} onClick={() => setTab("online-cum")}>
          🛒 온라인(누적){onlineCum ? ` · ${onlineCum.ym}` : ""}
        </TabBtn>
        <TabBtn active={tab === "online-month"} onClick={() => setTab("online-month")}>
          📱 온라인(당월){online ? ` · ${online.ym}` : ""}
        </TabBtn>
      </div>

      {/* 탭 내용 */}
      {tab === "off-cum" && (offCum ? <OfflineTab {...offCum} monthActive={monthActive} /> : <Empty table="sales_offline_cum" />)}
      {tab === "off-cum-detail" && (offCum ? <OfflineDetailTab periodLabel={offCum.periodLabel} prevLabel={offCum.prevLabel} brands={offCum.detailBrands} stores={offCum.stores} divisions={offCum.divisions} fashionCats={offCum.fashionCats} others={offCum.others} monthActive={monthActive} /> : <Empty table="sales_offline_cum" />)}
      {tab === "off-month" && (offMonth ? <OfflineTab {...offMonth} /> : <Empty table="sales_offline_month" />)}
      {tab === "off-month-detail" && (offMonth ? <OfflineDetailTab periodLabel={offMonth.periodLabel} prevLabel={offMonth.prevLabel} brands={offMonth.detailBrands} stores={offMonth.stores} divisions={offMonth.divisions} fashionCats={offMonth.fashionCats} others={offMonth.others} /> : <Empty table="sales_offline_month" />)}
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
