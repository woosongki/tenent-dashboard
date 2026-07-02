import type { TenantContract } from "@/lib/tenantContracts";

type Row = TenantContract & { daysUntilExpiry: number };

function urgencyBadge(days: number): string {
  if (days <= 14) return "bg-rose-300 text-[#0a0a0a] border-[#0a0a0a]";
  if (days <= 30) return "bg-orange-300 text-[#0a0a0a] border-[#0a0a0a]";
  if (days <= 60) return "bg-yellow-300 text-[#0a0a0a] border-[#0a0a0a]";
  return "bg-white text-[#0a0a0a] border-[#0a0a0a]";
}

function typeBadge(t: string): string {
  if (t.startsWith("임대갑")) return "bg-teal-100 text-teal-800 border-teal-300";
  if (t.startsWith("임대을")) return "bg-violet-100 text-violet-800 border-violet-300";
  if (t.startsWith("판매분특정")) return "bg-pink-100 text-pink-800 border-pink-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

export default function ExpiryTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="brutal bg-white p-8 text-center">
        <p className="font-mono text-[12px] text-[#0a0a0a]/60">
          해당 조건에 만료 임박 계약이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="brutal bg-white overflow-x-auto">
      <table className="w-full min-w-[900px] text-[12px]">
        <thead>
          <tr className="border-b-[2px] border-[#0a0a0a] bg-[#F1ECDB]">
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
          {rows.map((r, i) => (
            <tr
              key={`${r.contractNumber ?? r.businessId ?? r.brand}-${i}`}
              className="border-b border-[#0a0a0a]/10 hover:bg-[#FAF7EC]/60"
            >
              <td className="px-3 py-2 tabular-nums">
                <span
                  className={`inline-block border-[2px] px-2 py-0.5 text-[11px] font-extrabold ${urgencyBadge(r.daysUntilExpiry)}`}
                >
                  D-{r.daysUntilExpiry}
                </span>
              </td>
              <td className="px-3 py-2 font-mono tabular-nums text-[#0a0a0a]/80">{r.contractEndDate}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
