import Link from "next/link";
import { TYPO, ELEVATION } from "@/lib/tokens";

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  /** 보조 설명 (예: "전월 대비") */
  caption?: string;
  /** 트렌드 변화율 — 양수=상승(emerald), 음수=하락(rose), 0=평탄 */
  delta?: number;
  /** 트렌드 표시할 때 단위(% 또는 pp) */
  deltaUnit?: string;
  href?: string;
  /** raised(강조) | card(기본) */
  variant?: "raised" | "card";
  icon?: React.ReactNode;
}

export default function StatCard({
  label, value, unit, caption, delta, deltaUnit = "%", href, variant = "card", icon,
}: Props) {
  const elev = variant === "raised" ? ELEVATION.raised : ELEVATION.card;
  const Wrap: React.ElementType = href ? Link : "div";
  const wrapProps = href ? { href } : {};

  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const trendCls =
    !showDelta ? ""
    : delta! > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100"
    : delta! < 0 ? "text-rose-600 bg-rose-50 border-rose-100"
    : "text-slate-500 bg-slate-50 border-slate-200";
  const trendArrow =
    !showDelta ? ""
    : delta! > 0 ? "↗"
    : delta! < 0 ? "↘"
    : "→";

  return (
    <Wrap
      {...wrapProps}
      className={`${elev} rounded-2xl p-6 transition-all ${href ? "hover:shadow-[0_8px_24px_rgba(15,23,42,.08)] hover:-translate-y-0.5" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={TYPO.kpiLabel}>{label}</p>
        {icon && <span className="text-slate-300">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={TYPO.kpiNumber}>{value}</span>
        {unit && <span className="text-[16px] font-semibold text-slate-400">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {caption ? (
          <p className="text-[12px] text-slate-500">{caption}</p>
        ) : <span />}
        {showDelta && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded border ${trendCls}`}>
            {trendArrow} {Math.abs(delta!).toFixed(1)}{deltaUnit}
          </span>
        )}
      </div>
    </Wrap>
  );
}
