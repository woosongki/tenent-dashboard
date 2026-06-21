/**
 * 단위 명시 칩 — 표/카드의 금액 단위 혼동(억/백만/원)을 줄이기 위한 작은 라벨.
 * 예: <UnitChip>단위: 백만원</UnitChip>
 */
export default function UnitChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-1.5 py-0.5 text-[11px] font-bold text-[#0a0a0a] whitespace-nowrap">
      {children}
    </span>
  );
}
