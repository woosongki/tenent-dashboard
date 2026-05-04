/**
 * 보고용/인쇄용 하단 마크.
 * 사이드바가 빠지는 PDF/스크린샷 상황에서 페이지 정체성을 보존.
 */
export default function AppFooter() {
  const today = new Date();
  const ymd = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  return (
    <footer className="mt-12 border-t border-slate-200 pt-5 pb-2 px-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
      <p>
        © {today.getFullYear()} 이랜드리테일 · <span className="font-semibold text-slate-500">lifestyle 대시보드</span>
      </p>
      <p className="tabular-nums">데이터 기준 {ymd}</p>
    </footer>
  );
}
