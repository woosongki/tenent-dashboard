// 리테일 지도 전용 스켈레톤 — 지도 SDK + 체인 좌표(약 1.1MB) 로딩이 있어
// 전체 지도 캔버스 + 필터 패널 자리를 미리 그린다.
export default function HomeplusLoading() {
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="h-12 border-b-[3px] border-[#0a0a0a]/15 bg-[#FAF7EC]" />
      <div className="relative flex-1 overflow-hidden bg-[#F1ECDB]">
        {/* 지도 캔버스 자리 */}
        <div className="absolute inset-0 animate-pulse bg-[repeating-linear-gradient(45deg,#e8e2cf_0px,#e8e2cf_16px,#efe9d8_16px,#efe9d8_32px)]" />
        {/* 필터 패널 자리 */}
        <div className="absolute left-4 top-4 hidden w-[240px] animate-pulse flex-col gap-2 border-[3px] border-[#0a0a0a]/15 bg-white p-4 md:flex">
          <div className="h-4 w-28 bg-[#0a0a0a]/12" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 w-full bg-[#0a0a0a]/8" />
          ))}
        </div>
        {/* 로딩 표시 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-wider text-[#0a0a0a] shadow-[3px_3px_0_0_#0a0a0a]">
            지도 불러오는 중…
          </span>
        </div>
      </div>
    </div>
  );
}
