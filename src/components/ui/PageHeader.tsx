import { TYPO } from "@/lib/tokens";
import DataFreshnessBadge from "./DataFreshnessBadge";

interface Props {
  /** 작은 컬러 라벨 (예: "DASHBOARD") */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** 데이터 기준일 / 마지막 업데이트 (자유 문자열) */
  meta?: string;
  /** 데이터 기준월("YYYYMM"/"YYYY-MM") — 지정 시 지연 감지 배지 표시(meta보다 우선) */
  freshness?: string | null;
  /** freshness 배지 라벨 접두 (기본 "데이터 기준") */
  freshnessLabel?: string;
  action?: React.ReactNode;
}

/**
 * Neo-Brutalist 페이지 헤더.
 * - 좌측: yellow eyebrow chip + 매우 큰 디스플레이 타이틀 (영문은 archivo black)
 * - 우측: meta chip + action 버튼
 */
export default function PageHeader({ eyebrow, title, subtitle, meta, freshness, freshnessLabel, action }: Props) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b-[3px] border-[#0a0a0a] pb-6">
      <div className="min-w-0">
        {eyebrow && <span className={TYPO.eyebrow}>{eyebrow}</span>}
        <h1 className={`${TYPO.pageTitle} mt-3`}>{title}</h1>
        {subtitle && (
          <p className={`${TYPO.pageSubtitle} mt-3 max-w-2xl`}>{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* freshness(기준월 지연 감지) 우선, 없으면 자유 meta 문자열 */}
        {freshness ? (
          <DataFreshnessBadge monthYm={freshness} label={freshnessLabel} />
        ) : meta ? (
          <span className="inline-flex items-center gap-1.5 border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider tabular-nums shadow-[2px_2px_0_0_#0a0a0a]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {meta}
          </span>
        ) : null}
        {action}
      </div>
    </header>
  );
}
