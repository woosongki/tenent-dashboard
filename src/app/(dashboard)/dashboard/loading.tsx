// 대시보드 하위 라우트 공통 로딩 스켈레톤 — 무거운 페이지(매출분석·지도·적합도 등)
// 이동 시 빈 화면 대신 즉시 표시되어 체감 속도를 높인다.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar 자리 */}
      <div className="h-[42px] border-b-[2px] border-[#0a0a0a]/15 bg-white" />
      <main className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-[1400px] flex flex-col gap-6 animate-pulse">
          {/* 헤더 */}
          <div className="border-b-[3px] border-[#0a0a0a]/15 pb-6">
            <div className="h-3 w-24 bg-[#0a0a0a]/10" />
            <div className="mt-3 h-9 w-64 bg-[#0a0a0a]/10" />
            <div className="mt-3 h-4 w-96 max-w-full bg-[#0a0a0a]/5" />
          </div>
          {/* 카드 그리드 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 border-[2px] border-[#0a0a0a]/10 bg-[#F1ECDB]" />
            ))}
          </div>
          {/* 본문 블록 */}
          <div className="h-56 border-[2px] border-[#0a0a0a]/10 bg-[#F1ECDB]" />
          <div className="h-72 border-[2px] border-[#0a0a0a]/10 bg-[#F1ECDB]" />
        </div>
      </main>
    </div>
  );
}
