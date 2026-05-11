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

function IconBell() {
  return (
    <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
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

        <form action="">
          <button
            type="submit"
            title="새로고침"
            className="flex h-8 w-8 items-center justify-center border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] transition-colors hover:bg-yellow-300"
          >
            <IconRefresh />
          </button>
        </form>

        <button
          type="button"
          title="알림"
          className="relative flex h-8 w-8 items-center justify-center border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] transition-colors hover:bg-yellow-300"
        >
          <IconBell />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 border border-[#0a0a0a] bg-fuchsia-500" />
        </button>
      </div>
    </div>
  );
}
