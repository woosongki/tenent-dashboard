import SearchTrigger from "./SearchTrigger";
import NotificationBell from "./NotificationBell";
import RefreshButton from "./RefreshButton";

interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  crumbs: Crumb[];
  action?: React.ReactNode;
  /** 우측에 표시할 마지막 업데이트 시각 (ISO 문자열 or Date) — 실제 데이터 시점 */
  lastUpdated?: string | Date | null;
  /** 모바일 햄버거 클릭 핸들러 (모바일에서만 노출) */
  onOpenSidebar?: () => void;
}

function formatLastUpdated(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `오늘 ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function IconMenu() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function TopBar({ crumbs, action, lastUpdated, onOpenSidebar }: Props) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b-[3px] border-[#0a0a0a] bg-[#FAF7EC] px-4 sm:px-6">
      <div className="flex items-center gap-2 text-[12px] min-w-0">
        {onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="사이드바 열기"
            className="-ml-1 mr-1 flex h-8 w-8 items-center justify-center border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] transition-colors hover:bg-yellow-300 md:hidden"
          >
            <IconMenu />
          </button>
        )}
        <span className="shrink-0 border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[.16em]">lifestyle</span>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-[#0a0a0a]/40 font-bold">/</span>
            {c.href ? (
              <a href={c.href} className="truncate text-[11.5px] font-bold uppercase tracking-wider text-[#0a0a0a]/65 hover:text-[#0a0a0a] transition-colors">
                {c.label}
              </a>
            ) : (
              <span className="truncate text-[11.5px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">{c.label}</span>
            )}
          </span>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 ml-4">
        <SearchTrigger />

        {lastUpdated && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 border-[2px] border-[#0a0a0a] bg-white px-2 py-0.5 text-[10px] font-extrabold tabular-nums uppercase tracking-wider"
            title={`데이터 마지막 갱신: ${typeof lastUpdated === "string" ? lastUpdated : lastUpdated.toISOString()}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {formatLastUpdated(lastUpdated)}
          </span>
        )}

        {action && <div className="flex items-center">{action}</div>}

        <RefreshButton />

        <NotificationBell />
      </div>
    </div>
  );
}
