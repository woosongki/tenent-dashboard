"use client";

import { useState } from "react";
import OnlineMonthTab from "./OnlineMonthTab";
import OfflineTab from "./OfflineTab";
import type { OnlineRank, OffRank } from "@/lib/sales/queries";

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
  brands: OffRank[]; stores: OffRank[];
  divisions: { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }[];
  fashionCats: { cat: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }[];
}

interface Props {
  offCum: OffProps | null;        // 오프라인 누적 (5번)
  offMonth: OffProps | null;      // 오프라인 당월 (6번)
  online: OnlineProps | null;     // 온라인 당월 (9번)
  onlineCum: OnlineProps | null;  // 온라인 누적 (8번)
  children: React.ReactNode;      // 기존 매출 요약(레거시 CSV)
}

type TabKey = "off-cum" | "off-month" | "summary" | "online-cum" | "online-month";

export default function SalesTabsShell({ offCum, offMonth, online, onlineCum, children }: Props) {
  const [tab, setTab] = useState<TabKey>(offCum ? "off-cum" : "summary");

  return (
    <div className="space-y-4">
      {/* 탭 바 */}
      <div className="flex gap-1.5 overflow-x-auto border-b-[2px] border-[#0a0a0a] pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabBtn active={tab === "off-cum"} onClick={() => setTab("off-cum")}>
          🏆 누적{offCum ? ` · ${offCum.periodLabel}` : ""}
        </TabBtn>
        <TabBtn active={tab === "off-month"} onClick={() => setTab("off-month")}>
          📅 당월{offMonth ? ` · ${offMonth.periodLabel}` : ""}
        </TabBtn>
        <TabBtn active={tab === "online-cum"} onClick={() => setTab("online-cum")}>
          🛒 온라인(누적){onlineCum ? ` · ${onlineCum.ym}` : ""}
        </TabBtn>
        <TabBtn active={tab === "online-month"} onClick={() => setTab("online-month")}>
          📱 온라인(당월){online ? ` · ${online.ym}` : ""}
        </TabBtn>
        <TabBtn active={tab === "summary"} onClick={() => setTab("summary")}>
          📊 매출 요약(구)
        </TabBtn>
      </div>

      {/* 탭 내용 */}
      {tab === "off-cum" && (offCum ? <OfflineTab {...offCum} /> : <Empty table="sales_offline_cum" />)}
      {tab === "off-month" && (offMonth ? <OfflineTab {...offMonth} /> : <Empty table="sales_offline_month" />)}
      {tab === "summary" && <div>{children}</div>}
      {tab === "online-cum" && (onlineCum ? <OnlineMonthTab {...onlineCum} periodLabel="온라인 누적" /> : <Empty table="sales_online_cum" />)}
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
