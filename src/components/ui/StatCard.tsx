import Link from "next/link";
import { TYPO } from "@/lib/tokens";

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  caption?: string;
  delta?: number;
  deltaUnit?: string;
  href?: string;
  /** 강조 색상 (상단 블록) */
  accent?: "teal" | "magenta" | "yellow" | "violet" | "ink";
  icon?: React.ReactNode;
}

const ACCENT_BG: Record<NonNullable<Props["accent"]>, string> = {
  teal:    "bg-cyan-400",
  magenta: "bg-fuchsia-500",
  yellow:  "bg-yellow-300",
  violet:  "bg-violet-500",
  ink:     "bg-[#0a0a0a]",
};
const ACCENT_TEXT: Record<NonNullable<Props["accent"]>, string> = {
  teal:    "text-[#0a0a0a]",
  magenta: "text-white",
  yellow:  "text-[#0a0a0a]",
  violet:  "text-white",
  ink:     "text-white",
};

export default function StatCard({
  label, value, unit, caption, delta, deltaUnit = "%", href, accent = "yellow", icon,
}: Props) {
  const Wrap: React.ElementType = href ? Link : "div";
  const wrapProps = href ? { href } : {};

  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const trendBg =
    !showDelta ? ""
    : delta! > 0 ? "bg-emerald-400 text-emerald-950"
    : delta! < 0 ? "bg-rose-500 text-white"
    : "bg-[#F1ECDB] text-[#0a0a0a]";
  const trendArrow =
    !showDelta ? ""
    : delta! > 0 ? "↗"
    : delta! < 0 ? "↘"
    : "→";

  return (
    <Wrap
      {...wrapProps}
      className={`brutal ${href ? "brutal-hover" : ""} bg-white p-5 flex flex-col`}
    >
      {/* 상단 액센트 블록 */}
      <div className={`flex items-center justify-between gap-2 px-3 py-2 border-[2px] border-[#0a0a0a] ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}>
        <span className="text-[10px] font-extrabold uppercase tracking-[.14em]">{label}</span>
        {icon && <span>{icon}</span>}
      </div>

      {/* 숫자 */}
      <div className="mt-5 flex items-baseline gap-2">
        <span className={TYPO.kpiNumber}>{value}</span>
        {unit && <span className="text-[20px] font-extrabold text-[#0a0a0a]/60 font-mono">{unit}</span>}
      </div>

      {/* 캡션 + 트렌드 */}
      <div className="mt-3 flex items-center justify-between gap-2 min-h-[22px]">
        {caption ? (
          <p className="text-[11.5px] font-medium text-[#0a0a0a]/70 leading-tight">{caption}</p>
        ) : <span />}
        {showDelta && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold tabular-nums px-2 py-0.5 border-[2px] border-[#0a0a0a] ${trendBg}`}>
            {trendArrow} {Math.abs(delta!).toFixed(1)}{deltaUnit}
          </span>
        )}
      </div>
    </Wrap>
  );
}
