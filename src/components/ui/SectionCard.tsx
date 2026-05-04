import { TYPO, ELEVATION } from "@/lib/tokens";

interface Props {
  title?: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  /** raised(강조) | card(기본) | flat(테두리만) */
  variant?: "raised" | "card" | "flat";
  /** 패딩 사이즈 */
  size?: "default" | "compact";
  className?: string;
  children: React.ReactNode;
}

export default function SectionCard({
  title, description, eyebrow, action, variant = "card", size = "default", className = "", children,
}: Props) {
  const elev =
    variant === "raised" ? ELEVATION.raised :
    variant === "flat"   ? ELEVATION.flat   :
    ELEVATION.card;
  const padding = size === "compact" ? "p-5" : "p-6";

  return (
    <section className={`rounded-2xl ${elev} ${padding} ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 mb-5">
          <div>
            {eyebrow && <p className={TYPO.eyebrow}>{eyebrow}</p>}
            {title && <h2 className={`${TYPO.sectionTitle} ${eyebrow ? "mt-1" : ""}`}>{title}</h2>}
            {description && <p className={`${TYPO.sectionDesc} mt-1`}>{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
