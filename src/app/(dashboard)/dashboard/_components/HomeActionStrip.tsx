import Link from "next/link";
import type { HomeSummary } from "@/lib/dashboard/homeSummary";

// 홈 허브 — "오늘 봐야 할 것" 한 줄. 각 카드는 해당 페이지로 점프.
function Card({
  href, label, value, sub, tone = "default",
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "urgent" | "muted";
}) {
  const bg = tone === "urgent" ? "bg-rose-100" : tone === "muted" ? "bg-[#F1ECDB]" : "bg-white";
  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-1 flex-col justify-between border-[2px] border-[#0a0a0a] ${bg} px-3.5 py-3 shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_0_#0a0a0a]`}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a]/60">{label}</span>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[22px] font-extrabold tabular-nums leading-none text-[#0a0a0a]">{value}</span>
        {sub && <span className="text-[11px] font-bold text-[#0a0a0a]/55">{sub}</span>}
      </div>
    </Link>
  );
}

export default function HomeActionStrip({ summary }: { summary: HomeSummary }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Card
        href="/dashboard/contracts/expiry"
        label="계약만료 D-30"
        value={`${summary.expiryD30}건`}
        sub={summary.expiryD14 > 0 ? `D-14 ${summary.expiryD14}` : undefined}
        tone={summary.expiryD14 > 0 ? "urgent" : "default"}
      />
      <Card
        href="/dashboard/meetings"
        label="업체미팅"
        value={`${summary.meetingsActive}건`}
      />
      {summary.pendingApprovals !== null && (
        <Card
          href="/dashboard/admin/users"
          label="승인 대기"
          value={`${summary.pendingApprovals}명`}
          tone={summary.pendingApprovals > 0 ? "urgent" : "muted"}
        />
      )}
    </div>
  );
}
