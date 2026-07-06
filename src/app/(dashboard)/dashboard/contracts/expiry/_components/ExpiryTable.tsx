"use client";

import { Fragment, useState } from "react";
import type { TenantContract } from "@/lib/tenantContracts";

type Row = TenantContract & { daysUntilExpiry: number | null };

function urgencyBadge(days: number | null): string {
  if (days == null) return "bg-slate-100 text-slate-500 border-slate-300";  // 무기한
  if (days < 0) return "bg-slate-200 text-slate-600 border-slate-400";        // 만료 지남
  if (days <= 14) return "bg-rose-300 text-[#0a0a0a] border-[#0a0a0a]";
  if (days <= 30) return "bg-orange-300 text-[#0a0a0a] border-[#0a0a0a]";
  if (days <= 60) return "bg-yellow-300 text-[#0a0a0a] border-[#0a0a0a]";
  return "bg-white text-[#0a0a0a] border-[#0a0a0a]";
}

function dLabel(days: number | null): string {
  if (days == null) return "무기한";
  if (days < 0) return `만료 ${-days}일`;
  return `D-${days}`;
}

function typeBadge(t: string): string {
  if (t.startsWith("임대갑")) return "bg-teal-100 text-teal-800 border-teal-300";
  if (t.startsWith("임대을")) return "bg-violet-100 text-violet-800 border-violet-300";
  if (t.startsWith("판매분특정")) return "bg-pink-100 text-pink-800 border-pink-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function rowKey(r: Row, i: number): string {
  return `${r.contractNumber ?? r.businessId ?? r.brand}-${i}`;
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/50">{label}</span>
      <span className={`text-[12px] ${mono ? "font-mono" : ""} text-[#0a0a0a]/90 break-words`}>
        {value ?? <span className="text-[#0a0a0a]/40">—</span>}
      </span>
    </div>
  );
}

function DetailPanel({ r }: { r: Row }) {
  return (
    <div className="border-t-[2px] border-[#0a0a0a] bg-[#FAF7EC] px-6 py-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="계약번호" value={r.contractNumber} mono />
        <Field label="사업자번호" value={r.businessId} mono />
        <Field label="Plant 코드" value={r.plantCode} mono />
        <Field label="구매처 코드" value={r.purchaseCode} mono />

        <Field label="지점" value={r.storeName} />
        <Field label="층" value={r.floor} mono />
        <Field label="계약형태" value={r.contractType} />
        <Field label="구매그룹" value={r.purchaseGroup} mono />

        <Field label="브랜드" value={r.brand} />
        <Field label="구매처명" value={r.purchaseName} />
        <Field label="대표자" value={r.representative} />
        <Field label="MD" value={r.md} />

        <Field label="최초 계약일" value={r.firstContractDate} mono />
        <Field label="계약 시작일" value={r.contractStartDate} mono />
        <Field label="계약 만료일" value={r.contractEndDate} mono />
        <Field label="갱신 상태" value={r.renewalStatus ?? <span className="text-rose-600 font-bold">미결정</span>} />

        <Field label="담당자" value={r.contactPerson} />
        <Field label="전화" value={r.phone} mono />
        <Field label="이메일" value={r.email} mono />
        <Field label="지점 담당자" value={r.storeManager} />
      </div>
    </div>
  );
}

export default function ExpiryTable({ rows }: { rows: Row[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="brutal bg-white p-8 text-center">
        <p className="font-mono text-[12px] text-[#0a0a0a]/60">
          해당 조건에 계약이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="brutal bg-white overflow-x-auto">
      <table className="w-full min-w-[900px] text-[12px]">
        <thead>
          <tr className="border-b-[2px] border-[#0a0a0a] bg-[#F1ECDB]">
            <th className="w-8 px-2 py-2.5" aria-label="펼치기" />
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">D-일</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">만료일</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">지점</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">층</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">계약형태</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">브랜드</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">구매처</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">갱신</th>
            <th className="text-left px-3 py-2.5 font-extrabold uppercase tracking-wider text-[10.5px]">담당자</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const k = rowKey(r, i);
            const open = expandedKey === k;
            return (
              <Fragment key={k}>
                <tr
                  onClick={() => setExpandedKey(open ? null : k)}
                  aria-expanded={open}
                  className={`cursor-pointer border-b border-[#0a0a0a]/10 transition-colors ${
                    open ? "bg-[#F1ECDB]" : "hover:bg-[#FAF7EC]/60"
                  }`}
                >
                  <td className="px-2 py-2 text-center align-middle text-[#0a0a0a]/50">
                    <span
                      className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
                      aria-hidden
                    >
                      ▶
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    <span
                      className={`inline-block border-[2px] px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap ${urgencyBadge(r.daysUntilExpiry)}`}
                    >
                      {dLabel(r.daysUntilExpiry)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-[#0a0a0a]/80">{r.contractEndDate ?? "—"}</td>
                  <td className="px-3 py-2 font-bold">{r.storeName}</td>
                  <td className="px-3 py-2 font-mono text-[#0a0a0a]/70">{r.floor ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block border px-1.5 py-0.5 text-[10.5px] font-bold ${typeBadge(r.contractType)}`}
                    >
                      {r.contractType}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-bold">{r.brand}</td>
                  <td className="px-3 py-2 text-[#0a0a0a]/70">{r.purchaseName ?? "—"}</td>
                  <td className="px-3 py-2 text-[#0a0a0a]/70">{r.renewalStatus ?? <span className="text-rose-600 font-bold">미결정</span>}</td>
                  <td className="px-3 py-2 text-[#0a0a0a]/70">
                    {r.contactPerson && <span className="font-bold">{r.contactPerson}</span>}
                    {r.phone && <span className="block font-mono text-[10.5px]">{r.phone}</span>}
                    {r.email && <span className="block font-mono text-[10.5px]">{r.email}</span>}
                    {!r.contactPerson && !r.phone && !r.email && <span className="text-[#0a0a0a]/40">—</span>}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <DetailPanel r={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
