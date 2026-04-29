interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  crumbs: Crumb[];
  action?: React.ReactNode;
}

export default function TopBar({ crumbs, action }: Props) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#e8ecf0] bg-white px-7">
      <div className="flex items-center gap-1.5 text-[13px]">
        <span className="text-slate-400">lifestyle</span>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-slate-300">›</span>
            {c.href ? (
              <a href={c.href} className="font-medium text-slate-700 hover:text-violet-600 transition-colors">
                {c.label}
              </a>
            ) : (
              <span className="font-semibold text-slate-800">{c.label}</span>
            )}
          </span>
        ))}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
