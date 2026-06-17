/**
 * 데이터 기준월 뱃지.
 * - 기준월(예: "202606")을 "2026.06" 형태로 표시
 * - 기준월이 현재월보다 과거이면 노란 "갱신 필요" 경고 (월초 업데이트 누락 방지)
 *
 * 서버 컴포넌트에서 그대로 사용 가능 (요청 시점의 날짜 기준).
 */
interface Props {
  /** 데이터 기준 월. "YYYYMM" 또는 "YYYY-MM" */
  monthYm: string | null;
  /** 라벨 접두 (기본: "데이터 기준") */
  label?: string;
}

export default function DataFreshnessBadge({ monthYm, label = "데이터 기준" }: Props) {
  if (!monthYm) return null;

  const digits = monthYm.replace(/[^0-9]/g, "");
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  if (!year || !month) return null;

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  // 데이터 기준월이 현재월보다 과거이면 갱신 필요
  const monthsBehind = (curY - year) * 12 + (curM - month);
  const stale = monthsBehind >= 1;

  const periodText = `${year}.${String(month).padStart(2, "0")}`;

  if (stale) {
    return (
      <span className="inline-flex items-center gap-1.5 border-[2px] border-[#0a0a0a] bg-amber-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider tabular-nums shadow-[2px_2px_0_0_#0a0a0a]">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-700 animate-pulse" />
        {label} {periodText} · 갱신 필요 ({monthsBehind}개월 지연)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider tabular-nums shadow-[2px_2px_0_0_#0a0a0a]">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label} {periodText} · 최신
    </span>
  );
}
