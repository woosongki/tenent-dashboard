import { TYPO } from "@/lib/tokens";

interface Props {
  /** 작은 컬러 라벨 (예: "DASHBOARD") */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** 데이터 기준일 / 마지막 업데이트 (ISO string 또는 표시용 문자열) */
  meta?: string;
  action?: React.ReactNode;
}

/**
 * 보고용 큰 페이지 헤더.
 * - eyebrow: violet 작은 라벨
 * - title: 28px extrabold
 * - subtitle: 14px slate-500
 * - meta: 작은 데이터 기준일
 * - action: 우측 액션
 */
export default function PageHeader({ eyebrow, title, subtitle, meta, action }: Props) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-6">
      <div className="min-w-0">
        {eyebrow && <p className={TYPO.eyebrow}>{eyebrow}</p>}
        <h1 className={`${TYPO.pageTitle} mt-1`}>{title}</h1>
        {subtitle && <p className={`${TYPO.pageSubtitle} mt-1.5 max-w-2xl`}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {meta && (
          <span className="text-[12px] text-slate-400 tabular-nums whitespace-nowrap">
            {meta}
          </span>
        )}
        {action}
      </div>
    </header>
  );
}
