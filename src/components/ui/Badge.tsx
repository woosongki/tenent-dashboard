/**
 * 통일 Badge 컴포넌트.
 * tone × variant 조합으로 모든 상태 표현 (분야/등급/단계 등 카테고리는 colorMap helper로 처리).
 */

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "violet" | "amber";
export type BadgeVariant = "solid" | "soft" | "outline" | "dot";
export type BadgeSize = "xs" | "sm" | "md";

interface Props {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
  title?: string;
}

const TONE_BG: Record<BadgeTone, { soft: string; solid: string; outline: string; dot: string; text: string; border: string }> = {
  neutral: { soft: "bg-slate-100",   solid: "bg-slate-700 text-white",   outline: "border-slate-200 text-slate-700",  dot: "bg-slate-400",   text: "text-slate-700",   border: "border-slate-200" },
  brand:   { soft: "bg-violet-50",   solid: "bg-violet-600 text-white",  outline: "border-violet-200 text-violet-700",dot: "bg-violet-500",  text: "text-violet-700",  border: "border-violet-200" },
  success: { soft: "bg-emerald-50",  solid: "bg-emerald-600 text-white", outline: "border-emerald-200 text-emerald-700", dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200" },
  warning: { soft: "bg-amber-50",    solid: "bg-amber-500 text-white",   outline: "border-amber-200 text-amber-700",  dot: "bg-amber-400",   text: "text-amber-700",   border: "border-amber-200" },
  danger:  { soft: "bg-rose-50",     solid: "bg-rose-600 text-white",    outline: "border-rose-200 text-rose-700",    dot: "bg-rose-500",    text: "text-rose-700",    border: "border-rose-200" },
  info:    { soft: "bg-blue-50",     solid: "bg-blue-600 text-white",    outline: "border-blue-200 text-blue-700",    dot: "bg-blue-500",    text: "text-blue-700",    border: "border-blue-200" },
  violet:  { soft: "bg-violet-50",   solid: "bg-violet-600 text-white",  outline: "border-violet-200 text-violet-700",dot: "bg-violet-500",  text: "text-violet-700",  border: "border-violet-200" },
  amber:   { soft: "bg-amber-50",    solid: "bg-amber-500 text-white",   outline: "border-amber-200 text-amber-700",  dot: "bg-amber-400",   text: "text-amber-700",   border: "border-amber-200" },
};

const SIZE_CLS: Record<BadgeSize, string> = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-[11px] px-2 py-0.5",
  md: "text-[12px] px-2.5 py-1",
};

export default function Badge({
  tone = "neutral",
  variant = "soft",
  size = "sm",
  className = "",
  children,
  title,
}: Props) {
  const c = TONE_BG[tone];
  const base = "inline-flex items-center gap-1 rounded font-medium tracking-tight";
  let cls = "";

  switch (variant) {
    case "solid":
      cls = c.solid;
      break;
    case "outline":
      cls = `bg-white border ${c.outline}`;
      break;
    case "dot":
      cls = `bg-white border ${c.outline}`;
      return (
        <span title={title} className={`${base} ${SIZE_CLS[size]} ${cls} ${className}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          {children}
        </span>
      );
    case "soft":
    default:
      cls = `${c.soft} ${c.text} border ${c.border}`;
      break;
  }

  return (
    <span title={title} className={`${base} ${SIZE_CLS[size]} ${cls} ${className}`}>
      {children}
    </span>
  );
}

/**
 * 카테고리 → tone 매핑. 분야/단계/등급 등 무수한 카테고리를 의미 기반 5톤으로 압축.
 */
export const FIELD_TONE: Record<string, BadgeTone> = {
  "F&B":      "amber",
  "패션":     "danger",   // rose
  "리빙":     "success",  // emerald
  "뷰티":     "danger",
  "IP":       "brand",    // violet
  "체험/전시": "info",     // blue
};

export const STAGE_TONE: Record<string, BadgeTone> = {
  "확정":            "success",
  "조건 협의":        "info",
  "미팅 예정":        "brand",
  "컨택포인트 확보":   "neutral",
  "미확보":           "neutral",
};

export const GRADE_TONE: Record<string, BadgeTone> = {
  A: "warning",   // amber — 핵심
  B: "neutral",
  N: "neutral",
};

export const INTENSITY_TONE: Record<string, BadgeTone> = {
  high: "danger",
  mid:  "warning",
  low:  "success",
};
