import type { TenantContract } from "@/lib/tenantContracts";

function typeBadge(t: string): string {
  if (t.startsWith("임대갑")) return "bg-teal-100 text-teal-800 border-teal-300";
  if (t.startsWith("임대을")) return "bg-violet-100 text-violet-800 border-violet-300";
  if (t.startsWith("판매분특정")) return "bg-pink-100 text-pink-800 border-pink-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00").getTime();
  const to = new Date(toISO + "T00:00:00").getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function urgencyBadge(days: number): string | null {
  if (days < 0) return "bg-slate-100 text-slate-500 border-slate-300";
  if (days <= 14) return "bg-rose-300 text-[#0a0a0a] border-[#0a0a0a]";
  if (days <= 30) return "bg-orange-300 text-[#0a0a0a] border-[#0a0a0a]";
  if (days <= 60) return "bg-yellow-300 text-[#0a0a0a] border-[#0a0a0a]";
  return null;
}

export default function ContractPrefill({ contracts }: { contracts: TenantContract[] }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="brutal bg-white">
      <div className="border-b-[2px] border-[#0a0a0a]/15 px-5 py-3 flex items-baseline gap-3">
        <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
          계약 마스터 · 현재/최근 계약 조건
        </span>
        {contracts.length > 0 && (
          <span className="font-mono text-[11px] text-[#0a0a0a]/55">{contracts.length}건 매칭</span>
        )}
      </div>

      {contracts.length === 0 ? (
        <div className="p-5">
          <p className="font-mono text-[12px] text-[#0a0a0a]/55">
            브랜드명·구매처명으로 계약 마스터에서 매칭되는 항목을 찾지 못했습니다.
          </p>
        </div>
      ) : (
        <div className="divide-y-[2px] divide-[#0a0a0a]/10">
          {contracts.map((c, i) => {
            const days = c.contractEndDate ? daysBetween(today, c.contractEndDate) : null;
            const urgency = days != null ? urgencyBadge(days) : null;
            return (
              <div key={`${c.contractNumber ?? c.businessId ?? c.brand}-${i}`} className="p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-block border px-1.5 py-0.5 text-[10.5px] font-bold ${typeBadge(c.contractType)}`}>
                    {c.contractType}
                  </span>
                  <span className="font-bold text-[13px]">{c.storeName}</span>
                  {c.floor && <span className="font-mono text-[11px] text-[#0a0a0a]/55">· {c.floor}층</span>}
                  {c.purchaseGroup && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#0a0a0a]/55">
                      · {c.purchaseGroup}
                    </span>
                  )}
                  {urgency && days != null && (
                    <span className={`inline-block border-[2px] px-2 py-0.5 text-[10.5px] font-extrabold ${urgency}`}>
                      {days >= 0 ? `D-${days}` : `만료 ${-days}일 지남`}
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11.5px]">
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[9.5px] text-[#0a0a0a]/55">계약기간</dt>
                    <dd className="font-mono tabular-nums text-[#0a0a0a]/85">
                      {c.contractStartDate ?? "—"} → {c.contractEndDate ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[9.5px] text-[#0a0a0a]/55">최초계약일</dt>
                    <dd className="font-mono tabular-nums text-[#0a0a0a]/85">{c.firstContractDate ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[9.5px] text-[#0a0a0a]/55">갱신상태</dt>
                    <dd className={`font-mono ${c.renewalStatus ? "text-[#0a0a0a]/85" : "text-rose-600 font-bold"}`}>
                      {c.renewalStatus ?? "미결정"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-wider text-[9.5px] text-[#0a0a0a]/55">사업자·계약</dt>
                    <dd className="font-mono tabular-nums text-[#0a0a0a]/85">
                      {c.businessId ?? "—"}
                      {c.contractNumber && (
                        <span className="block text-[10px] text-[#0a0a0a]/55">계약 {c.contractNumber}</span>
                      )}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="font-mono uppercase tracking-wider text-[9.5px] text-[#0a0a0a]/55">담당</dt>
                    <dd className="text-[#0a0a0a]/85">
                      {c.contactPerson && <span className="font-bold">{c.contactPerson}</span>}
                      {c.phone && <span className="ml-2 font-mono text-[11px]">{c.phone}</span>}
                      {c.email && <span className="ml-2 font-mono text-[11px]">{c.email}</span>}
                      {!c.contactPerson && !c.phone && !c.email && <span className="text-[#0a0a0a]/40">—</span>}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
