import type { DashboardSummary, TopBrand } from "@/types/dashboard";

interface Props {
  summary: DashboardSummary;
}

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

export default function SummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 매출 성장 상위 Best3 */}
      <Best3Card brands={summary.topBrands.slice(0, 3)} />

      {/* 공실해결 */}
      <Card
        label="공실해결"
        value={summary.totalMembers.toLocaleString()}
        sub={`초대 대기 ${summary.pendingInvitations}건`}
        icon={<BuildingVacantIcon />}
        color="violet"
      />

      {/* 컨텐츠 수 */}
      <Card
        label="컨텐츠 수"
        value={summary.contentCount.toLocaleString()}
        sub="등록된 브랜드 콘텐츠"
        icon={<ContentIcon />}
        color="emerald"
      />

      {/* 팝업 수 */}
      <Card
        label="팝업 수"
        value={summary.activeSubscriptions.toLocaleString()}
        sub={`전체 조직 ${summary.totalOrgs}개 중`}
        icon={<SparklesIcon />}
        color="amber"
      />
    </div>
  );
}

// ── Best3 Card ───────────────────────────────────────────────
const RANK_COLORS = [
  { bg: "bg-amber-50",  text: "text-amber-600",  label: "1위" },
  { bg: "bg-gray-100",  text: "text-gray-500",   label: "2위" },
  { bg: "bg-orange-50", text: "text-orange-500", label: "3위" },
];

function Best3Card({ brands }: { brands: TopBrand[] }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-indigo-100 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">매출 성장 상위 Best3</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <TrophyIcon />
        </span>
      </div>

      {brands.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">데이터 없음</p>
      ) : (
        <div className="flex flex-col gap-2">
          {brands.map((b, i) => {
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

            return (
              <div key={b.rank} className="flex items-center gap-2">
                <span className={`flex h-6 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${c.bg} ${c.text}`}>
                  {c.label}
                </span>
                <span className="flex-1 truncate text-xs font-medium text-gray-700">
                  {b.brand_name}
                </span>
                <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${pos ? "text-emerald-600" : "text-rose-500"}`}>
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

// ── Generic Card ─────────────────────────────────────────────
type CardColor = "indigo" | "violet" | "emerald" | "rose" | "amber";

interface CardConfig {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: CardColor;
  trend?: number;
}

const colorMap: Record<CardColor, { ring: string; bg: string; icon: string }> = {
  indigo:  { ring: "ring-indigo-100",  bg: "bg-indigo-50",  icon: "text-indigo-600"  },
  violet:  { ring: "ring-violet-100",  bg: "bg-violet-50",  icon: "text-violet-600"  },
  emerald: { ring: "ring-emerald-100", bg: "bg-emerald-50", icon: "text-emerald-600" },
  rose:    { ring: "ring-rose-100",    bg: "bg-rose-50",    icon: "text-rose-600"    },
  amber:   { ring: "ring-amber-100",   bg: "bg-amber-50",   icon: "text-amber-600"   },
};

function Card({ label, value, sub, icon, color, trend }: CardConfig) {
  const c = colorMap[color];
  return (
    <div className={`rounded-2xl bg-white p-5 ring-1 ${c.ring} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bg} ${c.icon}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          {trend !== undefined && trend !== 0 && (
            <span className={trend > 0 ? "text-emerald-500" : "text-rose-500"}>
              {trend > 0 ? "▲" : "▼"}
            </span>
          )}
          {sub}
        </p>
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────
function TrophyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  );
}

function BuildingVacantIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}
