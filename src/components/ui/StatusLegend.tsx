/**
 * 매출 표 상태 배지 범례 — 퇴점/이탈/신규의 의미를 hover 없이 항상 보이게.
 * (기존엔 title 툴팁에만 있어 터치·스크린리더 사용자가 알 수 없었음)
 */
type Key = "closed" | "left" | "new";

const MAP: Record<Key, { sw: string; label: string; desc: string }> = {
  closed: { sw: "bg-rose-500",   label: "퇴점", desc: "전년만 매출" },
  left:   { sw: "bg-amber-500",  label: "이탈", desc: "당월 빠짐" },
  new:    { sw: "bg-violet-500", label: "신규", desc: "전년 없음" },
};

export default function StatusLegend({ items }: { items: Key[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {items.map((k) => {
        const m = MAP[k];
        return (
          <span key={k} className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className={`inline-block h-2.5 w-2.5 border border-[#0a0a0a] ${m.sw}`} aria-hidden="true" />
            <b className="text-[#0a0a0a]">{m.label}</b> {m.desc}
          </span>
        );
      })}
    </div>
  );
}
