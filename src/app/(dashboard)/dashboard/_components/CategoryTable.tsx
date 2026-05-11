"use client";

import { useState } from "react";
import type { CategoryGroup, OrgRow } from "@/types/dashboard";

interface Props {
  groups: CategoryGroup[];
}

export default function CategoryTable({ groups }: Props) {
  const [openPlans, setOpenPlans] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.planName)),
  );
  const [sortKey, setSortKey] = useState<keyof OrgRow>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function togglePlan(plan: string) {
    setOpenPlans((prev) => {
      const next = new Set(prev);
      next.has(plan) ? next.delete(plan) : next.add(plan);
      return next;
    });
  }

  function handleSort(key: keyof OrgRow) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortedOrgs(orgs: OrgRow[]): OrgRow[] {
    return [...orgs].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), "ko", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  if (groups.length === 0) {
    return (
      <div className=" bg-white ring-1 ring-gray-200 p-10 text-center text-sm text-gray-400">
        등록된 조직이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isOpen = openPlans.has(group.planName);

        return (
          <section
            key={group.planName}
            className="overflow-hidden  bg-white ring-1 ring-gray-200"
          >
            {/* ── Group Header ── */}
            <button
              type="button"
              onClick={() => togglePlan(group.planName)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <PlanBadge plan={group.planName} />
                <span className="font-semibold text-gray-800">{group.planDisplayName}</span>
                <span className="text-sm text-gray-400">{group.orgs.length}개 조직</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <span>멤버 {group.totalMembers.toLocaleString()}명</span>
                <span className="font-medium text-gray-700">
                  ${group.totalRevenue.toLocaleString()}/mo
                </span>
                <ChevronIcon open={isOpen} />
              </div>
            </button>

            {/* ── Table ── */}
            {isOpen && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                      {(
                        [
                          { key: "name",               label: "조직명" },
                          { key: "memberCount",         label: "멤버" },
                          { key: "maxSeats",            label: "최대 좌석" },
                          { key: "subscriptionStatus",  label: "구독 상태" },
                          { key: "billingInterval",     label: "결제 주기" },
                          { key: "currentPrice",        label: "금액" },
                          { key: "createdAt",           label: "생성일" },
                        ] as { key: keyof OrgRow; label: string }[]
                      ).map(({ key, label }) => (
                        <th
                          key={key}
                          className="cursor-pointer px-5 py-3 select-none whitespace-nowrap hover:text-gray-600"
                          onClick={() => handleSort(key)}
                        >
                          <span className="flex items-center gap-1">
                            {label}
                            {sortKey === key && (
                              <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedOrgs(group.orgs).map((org) => (
                      <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                        {/* 조직명 */}
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-medium text-gray-900">{org.name}</p>
                            <p className="text-xs text-gray-400">{org.slug}</p>
                          </div>
                        </td>

                        {/* 멤버 수 + 좌석 바 */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{org.memberCount}</span>
                            <SeatBar used={org.memberCount} max={org.maxSeats} />
                          </div>
                        </td>

                        {/* 최대 좌석 */}
                        <td className="px-5 py-3.5 text-gray-500">{org.maxSeats}</td>

                        {/* 구독 상태 */}
                        <td className="px-5 py-3.5">
                          <StatusBadge status={org.subscriptionStatus} />
                        </td>

                        {/* 결제 주기 */}
                        <td className="px-5 py-3.5 text-gray-500 capitalize">
                          {org.billingInterval === "monthly"
                            ? "월간"
                            : org.billingInterval === "yearly"
                            ? "연간"
                            : "-"}
                        </td>

                        {/* 금액 */}
                        <td className="px-5 py-3.5 font-medium text-gray-800">
                          {org.currentPrice === 0 ? "무료" : `$${org.currentPrice}`}
                        </td>

                        {/* 생성일 */}
                        <td className="px-5 py-3.5 text-gray-400">
                          {org.createdAt
                            ? new Date(org.createdAt).toLocaleDateString("ko-KR", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              })
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    free:       "bg-gray-100 text-gray-600",
    pro:        "bg-indigo-100 text-indigo-700",
    enterprise: "bg-violet-100 text-violet-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[plan] ?? "bg-gray-100 text-gray-600"}`}
    >
      {plan.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:   { label: "활성",     className: "bg-emerald-100 text-emerald-700" },
    trialing: { label: "체험 중",  className: "bg-sky-100 text-sky-700" },
    past_due: { label: "결제 지연", className: "bg-amber-100 text-amber-700" },
    canceled: { label: "해지",     className: "bg-red-100 text-red-600" },
    unpaid:   { label: "미납",     className: "bg-rose-100 text-rose-700" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}

function SeatBar({ used, max }: { used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  const barColor =
    pct >= 90 ? "bg-rose-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
