// 상권분석 점포 상세 전용 스켈레톤 — 외부 API(실거래가·혼잡도)·지도 로딩이 있어
// 페이지 모양(지도 + 섹션 그리드)을 미리 그려 체감 지연을 줄인다.
export default function BranchDetailLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-12 border-b-[3px] border-[#0a0a0a]/15 bg-[#FAF7EC]" />
      <main className="flex-1 overflow-y-auto px-7 py-6">
        <div className="animate-pulse space-y-5">
          {/* 헤더 */}
          <div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 bg-[#0a0a0a]/15" />
              <div className="h-3 w-20 bg-[#0a0a0a]/10" />
            </div>
            <div className="mt-2 h-7 w-56 bg-[#0a0a0a]/15" />
            <div className="mt-2 h-3 w-80 max-w-full bg-[#0a0a0a]/8" />
          </div>

          {/* 위치(지도) + 주변상권 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="brutal bg-white p-5 lg:col-span-2">
              <div className="mb-4 h-5 w-16 bg-yellow-300/50" />
              <div className="h-[320px] border-[2px] border-[#0a0a0a]/10 bg-[#F1ECDB]" />
            </div>
            <div className="brutal bg-white p-5">
              <div className="mb-4 h-5 w-32 bg-yellow-300/50" />
              <div className="space-y-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-2 w-full bg-[#0a0a0a]/8" />
                ))}
              </div>
            </div>
          </div>

          {/* 와이드 섹션들 */}
          <div className="h-40 brutal bg-[#F1ECDB]" />
          <div className="h-52 brutal bg-[#F1ECDB]" />
          <div className="h-44 brutal bg-[#F1ECDB]" />
        </div>
      </main>
    </div>
  );
}
