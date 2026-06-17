"use client";

import { useState } from "react";
import OnlineMonthTab from "./OnlineMonthTab";
import type { OnlineRank } from "@/lib/sales/queries";

interface OnlineProps {
  ym: string;
  prevYm: string;
  total: number;
  prevTotal: number;
  yoyPct: number;
  brands: OnlineRank[];
  stores: OnlineRank[];
  channels: { channel: string; s: number; ps: number; yoyPct: number }[];
}

interface Props {
  online: OnlineProps | null;   // null = 온라인 데이터 없음
  children: React.ReactNode;    // 기존 매출분석(오프라인) 콘텐츠
}

type TabKey = "offline" | "online-month";

export default function SalesTabsShell({ online, children }: Props) {
  const [tab, setTab] = useState<TabKey>("offline");

  return (
    <div className="space-y-4">
      {/* 탭 바 */}
      <div className="flex gap-1.5 border-b-[2px] border-[#0a0a0a] pb-px">
        <TabBtn active={tab === "offline"} onClick={() => setTab("offline")}>
          📊 매출 요약
        </TabBtn>
        <TabBtn active={tab === "online-month"} onClick={() => setTab("online-month")}>
          📱 온라인(당월){online ? ` · ${online.ym}` : ""}
        </TabBtn>
      </div>

      {/* 탭 내용 */}
      {tab === "offline" && <div>{children}</div>}
      {tab === "online-month" && (
        online
          ? <OnlineMonthTab {...online} />
          : <div className="border-[2px] border-dashed border-slate-300 p-10 text-center text-[13px] text-slate-400">
              온라인 데이터가 없습니다. <code className="text-[11px]">sales_online_monthly</code> 테이블에 CSV를 import 하세요.
            </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-[2px] border-b-0 px-4 py-2 text-[13px] font-bold transition ${
        active
          ? "border-[#0a0a0a] bg-yellow-300 text-[#0a0a0a]"
          : "border-transparent bg-transparent text-slate-400 hover:text-[#0a0a0a]"
      }`}
    >
      {children}
    </button>
  );
}
