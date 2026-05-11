import { TYPO } from "@/lib/tokens";

interface Props {
  title?: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  /** raised(강조) | card(기본) | flat(테두리만) */
  variant?: "raised" | "card" | "flat";
  /** 액센트 컬러 — 좌측 컬러 바 (eyebrow 옆) */
  accent?: "teal" | "magenta" | "yellow" | "violet" | "ink" | "none";
  size?: "default" | "compact";
  className?: string;
  children: React.ReactNode;
}

const ACCENT_BG: Record<NonNullable<Props["accent"]>, string> = {
  teal:    "bg-cyan-400",
  magenta: "bg-fuchsia-500",
  yellow:  "bg-yellow-300",
  violet:  "bg-violet-500",
  ink:     "bg-[#0a0a0a]",
  none:    "",
};

export default function SectionCard({
  title, description, eyebrow, action, variant = "card", accent = "none",
  size = "default", className = "", children,
}: Props) {
  const elev =
    variant === "raised" ? "brutal-lg" :
    variant === "flat"   ? "brutal-flat" :
    "brutal";
  const padding = size === "compact" ? "p-5" : "p-6";
  const bg = "bg-white";

  return (
    <section className={`${elev} ${bg} ${padding} ${className}`}>
      {(title || action || eyebrow) && (
        <header className="flex items-start justify-between gap-3 mb-5">
          <div>
            {eyebrow && (
              <span className={`${TYPO.eyebrow} ${accent !== "none" ? ACCENT_BG[accent] : ""}`}>
                {eyebrow}
              </span>
            )}
            {title && (
              <h2 className={`${TYPO.sectionTitle} ${eyebrow ? "mt-2" : ""}`}>{title}</h2>
            )}
            {description && (
              <p className={`${TYPO.sectionDesc} mt-1`}>{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
