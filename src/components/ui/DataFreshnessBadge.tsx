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

  const periodText = `${year}.${String(month).padStart(2, "0")}`;

  return (
    <span className="inline-flex items-center gap-1.5 border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider tabular-nums shadow-[2px_2px_0_0_#0a0a0a]">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label} {periodText}
    </span>
  );
}
