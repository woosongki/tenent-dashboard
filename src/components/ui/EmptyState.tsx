interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: "py-10",
  md: "py-16",
  lg: "py-24",
};

export default function EmptyState({ title, description, action, icon, size = "md" }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-[#e8ecf0] bg-white text-center shadow-[0_1px_3px_rgba(0,0,0,.04)] ${SIZE[size]}`}>
      {icon ? (
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-400">
          {icon}
        </div>
      ) : (
        <svg className="mb-3 h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      )}
      <p className="text-[15px] font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 text-[13px] text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
