import type { DashboardSummary, TopBrand } from "@/types/dashboard";

interface Props {
  summary: DashboardSummary;
}

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

export default function SummaryCards({ summary }: Props) {
  const completionRate = summary.contentCount > 0
    ? Math.round((summary.positiveGrowthCount / summary.contentCount) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {/* 공실해결 — violet */}
      <MetricCard
        accent="violet"
        label="공실해결"
        value={summary.totalMembers.toLocaleString()}
        sub={`초대 대기 ${summary.pendingInvitations}건`}
        trend={{ value: summary.pendingInvitations, label: "대기" }}
        icon="🏢"
      />

      {/* 컨텐츠 수 — emerald */}
      <MetricCard
        accent="emerald"
        label="컨텐츠 수"
        value={summary.contentCount.toLocaleString()}
        sub="등록된 브랜드 콘텐츠"
        icon="📋"
      />

      {/* 팝업 수 — amber */}
      <MetricCard
        accent="amber"
        label="팝업 수"
        value={summary.activeSubscriptions.toLocaleString()}
        sub={`전체 조직 ${summary.totalOrgs}개 중`}
        icon="✨"
      />

      {/* 입점 완료율 — rose */}
      <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-rose-500 to-rose-300" />
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-slate-500">입점 완료율</span>
          <span className="text-[16px]">📊</span>
        </div>
        <p className="mt-3 text-[28px] font-extrabold tracking-tight text-slate-900 leading-none">
          {completionRate}<span className="text-[16px] font-semibold text-slate-400">%</span>
        </p>
        <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-rose-50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-300">
          성장 브랜드 {summary.positiveGrowthCount} / 전체 {summary.contentCount}
        </p>
      </div>
    </div>
  );
}

// ── Best3 Card (used below summary in page) ──────────────────
const RANK_COLORS = [
  { bg: "bg-amber-100",  text: "text-amber-800",  bar: "from-amber-400 to-yellow-300" },
  { bg: "bg-slate-100",  text: "text-slate-600",  bar: "from-violet-500 to-violet-300" },
  { bg: "bg-orange-100", text: "text-orange-700", bar: "from-sky-400 to-sky-300" },
];

export function Best3Card({ brands }: { brands: TopBrand[] }) {
  const maxAmt = brands.reduce((max, b) => {
    const amt = b.revenue_current !== null && b.revenue_prev !== null
      ? Math.abs(b.revenue_current - b.revenue_prev) : 0;
    return amt > max ? amt : max;
  }, 1);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-violet-500" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold text-slate-800">🏆 매출 성장 상위 Best 3</p>
          <p className="text-[11px] text-slate-400">이번 달 매출 성장액 기준</p>
        </div>
        <a href="/dashboard/sales" className="flex items-center gap-0.5 text-[11px] font-medium text-violet-600 hover:text-violet-800">
          전체 보기 <span>→</span>
        </a>
      </div>

      {brands.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">데이터 없음</p>
      ) : (
        <div className="space-y-2">
          {brands.slice(0, 3).map((b, i) => {
            const c = RANK_COLORS[i] ?? RANK_COLORS[2];
            const growthAmt =
              b.revenue_current !== null && b.revenue_prev !== null
                ? b.revenue_current - b.revenue_prev : null;
            const pos = growthAmt !== null ? growthAmt >= 0 : b.revenue_growth >= 0;
            const display = growthAmt !== null
              ? KRW.format(Math.abs(growthAmt))
              : `${Math.abs(b.revenue_growth).toFixed(1)}%`;
            const pct = growthAmt !== null ? (Math.abs(growthAmt) / maxAmt) * 100 : 0;

            return (
              <div key={b.rank} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <span className={`flex h-[22px] w-7 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-black ${c.bg} ${c.text}`}>
                  {i + 1}위
                </span>
                <span className="w-24 truncate text-[13px] font-semibold text-slate-700">{b.brand_name}</span>
                <div className="flex-1 h-[4px] rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`shrink-0 text-[12px] font-bold tabular-nums ${pos ? "text-emerald-600" : "text-rose-500"}`}>
                  {pos ? "▲" : "▼"} {display}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────
type Accent = "violet" | "emerald" | "amber" | "rose" | "indigo";

const ACCENT: Record<Accent, { gradient: string; iconBg: string }> = {
  violet:  { gradient: "from-violet-600 to-violet-400",  iconBg: "bg-violet-50" },
  emerald: { gradient: "from-emerald-600 to-emerald-400", iconBg: "bg-emerald-50" },
  amber:   { gradient: "from-amber-500 to-amber-300",     iconBg: "bg-amber-50" },
  rose:    { gradient: "from-rose-500 to-rose-300",       iconBg: "bg-rose-50" },
  indigo:  { gradient: "from-indigo-600 to-indigo-400",   iconBg: "bg-indigo-50" },
};

interface MetricCardProps {
  accent: Accent;
  label: string;
  value: string;
  sub: string;
  icon: string;
  trend?: { value: number; label: string };
}

function MetricCard({ accent, label, value, sub, icon, trend }: MetricCardProps) {
  const a = ACCENT[accent];
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className={`absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r ${a.gradient}`} />
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-500">{label}</span>
        <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[16px] ${a.iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-[28px] font-extrabold tracking-tight text-slate-900 leading-none">{value}</p>
      {trend ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px]">
          <span className="font-semibold text-emerald-500">▲ {trend.value}</span>
          <span className="text-slate-300">{trend.label}</span>
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-300">{sub}</p>
      )}
    </div>
  );
}
