/**
 * Neo-Brutalist Badge.
 * tone × variant — 모두 검정 테두리 + 굵은 폰트.
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

const TONE: Record<BadgeTone, { solid: string; soft: string; dot: string }> = {
  neutral: { solid: "bg-[#0a0a0a] text-white",        soft: "bg-[#F1ECDB] text-[#0a0a0a]", dot: "bg-[#0a0a0a]" },
  brand:   { solid: "bg-violet-500 text-white",        soft: "bg-violet-100 text-violet-950", dot: "bg-violet-500" },
  success: { solid: "bg-emerald-500 text-white",       soft: "bg-emerald-200 text-emerald-950", dot: "bg-emerald-500" },
  warning: { solid: "bg-amber-300 text-amber-950",     soft: "bg-amber-100 text-amber-950", dot: "bg-amber-400" },
  danger:  { solid: "bg-rose-500 text-white",          soft: "bg-rose-100 text-rose-950", dot: "bg-rose-500" },
  info:    { solid: "bg-cyan-400 text-cyan-950",       soft: "bg-cyan-100 text-cyan-950", dot: "bg-cyan-500" },
  violet:  { solid: "bg-violet-500 text-white",        soft: "bg-violet-100 text-violet-950", dot: "bg-violet-500" },
  amber:   { solid: "bg-amber-300 text-amber-950",     soft: "bg-amber-100 text-amber-950", dot: "bg-amber-400" },
};

const SIZE: Record<BadgeSize, string> = {
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
  const c = TONE[tone];
  const base = "inline-flex items-center gap-1 rounded-none border-[2px] border-[#0a0a0a] font-extrabold uppercase tracking-wider";

  if (variant === "dot") {
    return (
      <span title={title} className={`${base} ${SIZE[size]} bg-white text-[#0a0a0a] ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
        {children}
      </span>
    );
  }
  if (variant === "outline") {
    return (
      <span title={title} className={`${base} ${SIZE[size]} bg-white text-[#0a0a0a] ${className}`}>
        {children}
      </span>
    );
  }
  if (variant === "soft") {
    return (
      <span title={title} className={`${base} ${SIZE[size]} ${c.soft} ${className}`}>
        {children}
      </span>
    );
  }
  // solid
  return (
    <span title={title} className={`${base} ${SIZE[size]} ${c.solid} ${className}`}>
      {children}
    </span>
  );
}

/** 카테고리 → tone 매핑 (압축 5톤) */
export const FIELD_TONE: Record<string, BadgeTone> = {
  "F&B":      "warning",
  "패션":     "danger",
  "리빙":     "success",
  "뷰티":     "danger",
  "IP":       "brand",
  "체험/전시": "info",
};

export const STAGE_TONE: Record<string, BadgeTone> = {
  "확정":            "success",
  "조건 협의":        "info",
  "미팅 예정":        "brand",
  "컨택포인트 확보":   "neutral",
  "미확보":           "neutral",
};

export const GRADE_TONE: Record<string, BadgeTone> = {
  A: "warning",
  B: "neutral",
  N: "neutral",
};

export const INTENSITY_TONE: Record<string, BadgeTone> = {
  high: "danger",
  mid:  "warning",
  low:  "success",
};
