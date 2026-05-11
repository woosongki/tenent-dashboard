/**
 * Brutalist 보고용/인쇄용 하단 마크.
 */
export default function AppFooter() {
  const today = new Date();
  const ymd = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-[#0a0a0a] pt-5">
      <div className="flex items-center gap-3">
        <span className="inline-block border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.18em]">
          lifestyle
        </span>
        <p className="text-[11px] font-medium text-[#0a0a0a]/65">
          © {today.getFullYear()} 이랜드리테일 · 컨텐츠 운영 대시보드
        </p>
      </div>
      <p className="text-[11px] font-bold tabular-nums uppercase tracking-wider text-[#0a0a0a]">
        DATA · {ymd}
      </p>
    </footer>
  );
}
