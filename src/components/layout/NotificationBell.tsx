"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface ExpiryItem {
  storeName: string;
  brand: string;
  purchaseName: string | null;
  contractEndDate: string | null;
  daysUntilExpiry: number;
}
interface Summary { d14: number; d30: number; items: ExpiryItem[]; }

// 모듈 레벨 캐시 — 페이지 이동마다 재요청하지 않도록 5분 유지.
let cached: { at: number; data: Summary } | null = null;
const TTL = 5 * 60 * 1000;

function IconBell() {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

// 실동작 알림 벨 — 30일 이내 만료 임박 계약을 뱃지·드롭다운으로. (기존 장식용 점 대체)
export default function NotificationBell() {
  const [summary, setSummary] = useState<Summary | null>(cached?.data ?? null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 초기 state가 이미 캐시를 반영하므로, 신선하면 재요청만 생략.
    if (cached && Date.now() - cached.at < TTL) return;
    let alive = true;
    fetch("/api/contracts/expiring-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Summary | null) => {
        if (!alive || !d) return;
        cached = { at: Date.now(), data: d };
        setSummary(d);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = summary?.d30 ?? 0;
  const urgent = (summary?.d14 ?? 0) > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={count > 0 ? `만료 임박 계약 ${count}건` : "알림"}
        aria-label={count > 0 ? `알림 ${count}건` : "알림"}
        className="relative flex h-8 w-8 items-center justify-center border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] transition-colors hover:bg-yellow-300"
      >
        <IconBell />
        {count > 0 && (
          <span
            className={`absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center border-[2px] border-[#0a0a0a] px-0.5 text-[9px] font-black tabular-nums text-white ${urgent ? "bg-rose-500" : "bg-fuchsia-500"}`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[2100] mt-2 w-[300px] border-[3px] border-[#0a0a0a] bg-white shadow-[4px_4px_0_0_#0a0a0a]">
          <div className="flex items-center justify-between border-b-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-3 py-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">계약만료 임박</span>
            {summary && summary.d14 > 0 && (
              <span className="border-[1.5px] border-[#0a0a0a] bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                D-14 {summary.d14}건
              </span>
            )}
          </div>

          {summary && summary.items.length > 0 ? (
            <ul className="max-h-[320px] overflow-y-auto">
              {summary.items.map((it, i) => {
                const soon = it.daysUntilExpiry <= 14;
                return (
                  <li key={i} className="border-b border-[#0a0a0a]/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-bold text-[#0a0a0a]">
                        {it.purchaseName || it.brand}
                      </span>
                      <span className={`shrink-0 border-[1.5px] border-[#0a0a0a] px-1.5 py-0.5 text-[9px] font-black tabular-nums ${soon ? "bg-rose-500 text-white" : "bg-yellow-300 text-[#0a0a0a]"}`}>
                        D-{it.daysUntilExpiry}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-[#0a0a0a]/55">
                      {it.storeName} · ~{it.contractEndDate ?? "-"}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-[12px] font-bold text-[#0a0a0a]/55">
              30일 이내 만료 임박 계약이 없습니다.
            </p>
          )}

          <Link
            href="/dashboard/contracts/expiry"
            onClick={() => setOpen(false)}
            className="block border-t-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-2 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a] transition-colors hover:bg-yellow-400"
          >
            계약만료 알람 전체 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
