import Link from "next/link";
import type { DashboardSummary, TopBrand } from "@/types/dashboard";

interface Props {
  summary: DashboardSummary;
}

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

// ── SVG 아이콘 ────────────────────────────────────────────────
// ⑤ 이모지 대신 일관된 SVG 아이콘 사용

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function IconDocument({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function IconChartBar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── 트렌드 뱃지 ─────────────────────────────────────────────
// ② 트렌드 인디케이터: 방향 + 수치 + 설명
interface TrendBadgeProps {
  direction: "up" | "down" | "neutral";
  value: string;
  label: string;
}
function TrendBadge({ direction, value, label }: TrendBadgeProps) {
  const styles = {
    up:      { dot: "bg-emerald-500", text: "text-emerald-600", arrow: "▲" },
    down:    { dot: "bg-rose-500",    text: "text-rose-500",    arrow: "▼" },
    neutral: { dot: "bg-slate-400",   text: "text-slate-400",   arrow: "—" },
  };
  const s = styles[direction];
  return (
    <p className="mt-2 flex items-center gap-1.5 text-[11px]">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={`font-semibold tabular-nums ${s.text}`}>
        {s.arrow} {value}
      </span>
      <span className="text-slate-300">{label}</span>
    </p>
  );
}

// ── Summary Cards ────────────────────────────────────────────
export default function SummaryCards({ summary }: Props) {
  // 입점 완료율은 brand_performance 기준 — 컨텐츠 풀과 별개 지표
  const completionRate = summary.brandTotalCount > 0
    ? Math.round((summary.positiveGrowthCount / summary.brandTotalCount) * 100)
    : 0;

  // 컨텐츠 풀 트렌드 라벨 — 가장 큰 카테고리 기준 한 줄 요약
  const pool = summary.contentPoolBreakdown;
  const poolTrendLabel = `라이프 ${pool.lifestyle} · F&B ${pool.fnb} · 팝업 ${pool.popup}`;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

      {/* 공실해결 — violet */}
      <MetricCard
        href="/dashboard/drilldown"
        accent="violet"
        label="공실해결 건수"
        value={summary.totalMembers.toLocaleString()}
        icon={<IconBuilding className="h-[18px] w-[18px] text-violet-600" />}
        iconBg="bg-violet-50"
        trend={{ direction: "up", value: `${summary.pendingInvitations}건`, label: "초대 대기 중" }}
      />

      {/* 컨텐츠 수 — emerald — 사이드바 "컨텐츠 풀" 3개 탭 합계 */}
      <MetricCard
        href="/dashboard/goals"
        accent="emerald"
        label="컨텐츠 수"
        value={summary.contentPoolCount.toLocaleString()}
        icon={<IconDocument className="h-[18px] w-[18px] text-emerald-600" />}
        iconBg="bg-emerald-50"
        trend={{
          direction: summary.contentPoolCount > 0 ? "up" : "neutral",
          value: poolTrendLabel,
          label: "",
        }}
      />

      {/* 팝업 수 — amber */}
      <MetricCard
        href="/dashboard/goals?tab=popup"
        accent="amber"
        label="팝업 수"
        value={summary.activeSubscriptions.toLocaleString()}
        icon={<IconSparkles className="h-[18px] w-[18px] text-amber-600" />}
        iconBg="bg-amber-50"
        trend={{
          direction: "neutral",
          value: `${summary.totalOrgs}개`,
          label: "전체 조직",
        }}
      />

      {/* 입점 완료율 — rose */}
      <Link
        href="/dashboard/drilldown"
        className="group relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-rose-500 to-rose-300" />
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-slate-500">입점 완료율</span>
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-rose-50">
            <IconChartBar className="h-[18px] w-[18px] text-rose-500" />
          </div>
        </div>
        <p className="mt-3 text-[28px] font-extrabold leading-none tracking-tight text-slate-900">
          {completionRate}<span className="text-[16px] font-semibold text-slate-400">%</span>
        </p>
        <div className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-rose-50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <TrendBadge
          direction={completionRate >= 50 ? "up" : "neutral"}
          value={`${summary.positiveGrowthCount} / ${summary.brandTotalCount}`}
          label="성장 / 전체 브랜드"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">
          상세 →
        </span>
      </Link>
    </div>
  );
}

// ── Best3 Card ────────────────────────────────────────────────
const RANK_COLORS = [
  { bg: "bg-amber-100",  text: "text-amber-800",  bar: "from-amber-400 to-yellow-300" },
  { bg: "bg-slate-100",  text: "text-slate-600",  bar: "from-violet-500 to-violet-300" },
  { bg: "bg-orange-100", text: "text-orange-700", bar: "from-sky-400 to-sky-300" },
];

export function Best3Card({ brands }: { brands: TopBrand[] }) {
  const maxAmt = brands.reduce((max, b) => {
    const amt =
      b.revenue_current !== null && b.revenue_prev !== null
        ? Math.abs(b.revenue_current - b.revenue_prev)
        : 0;
    return amt > max ? amt : max;
  }, 1);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-violet-500" />
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* ⑤ 이모지 → SVG */}
          <IconTrophy className="h-4 w-4 text-amber-500" />
          <div>
            <p className="text-[13px] font-bold text-slate-800">매출 성장 상위 Best 3</p>
            <p className="text-[11px] text-slate-400">이번 달 매출 성장액 기준</p>
          </div>
        </div>
        <a
          href="/dashboard/sales"
          className="flex items-center gap-0.5 text-[11px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
        >
          전체 보기
          <IconArrowRight className="h-3 w-3" />
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
                ? b.revenue_current - b.revenue_prev
                : null;
            const pos = growthAmt !== null ? growthAmt >= 0 : b.revenue_growth >= 0;
            const display =
              growthAmt !== null
                ? KRW.format(Math.abs(growthAmt))
                : `${Math.abs(b.revenue_growth).toFixed(1)}%`;
            const pct = growthAmt !== null ? (Math.abs(growthAmt) / maxAmt) * 100 : 0;

            return (
              <div key={b.rank} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <span className={`flex h-[22px] w-7 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-black ${c.bg} ${c.text}`}>
                  {i + 1}위
                </span>
                <span className="w-24 truncate text-[13px] font-semibold text-slate-700">
                  {b.brand_name}
                </span>
                <div className="flex-1 h-[4px] overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-500`}
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

const GRADIENT: Record<Accent, string> = {
  violet:  "from-violet-600 to-violet-400",
  emerald: "from-emerald-600 to-emerald-400",
  amber:   "from-amber-500 to-amber-300",
  rose:    "from-rose-500 to-rose-300",
  indigo:  "from-indigo-600 to-indigo-400",
};

interface MetricCardProps {
  accent: Accent;
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  trend: { direction: "up" | "down" | "neutral"; value: string; label: string };
  href?: string;
}

function MetricCard({ accent, label, value, icon, iconBg, trend, href }: MetricCardProps) {
  const inner = (
    <>
      <div className={`absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r ${GRADIENT[accent]}`} />
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-500">{label}</span>
        <div className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-[28px] font-extrabold leading-none tracking-tight text-slate-900">
        {value}
      </p>
      <TrendBadge direction={trend.direction} value={trend.value} label={trend.label} />
      {href && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">
          상세 →
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e8ecf0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      {inner}
    </div>
  );
}
