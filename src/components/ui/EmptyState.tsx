interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  namedIcon?: NamedIcon;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
}

type NamedIcon = "folder" | "search" | "calendar" | "users" | "chart" | "inbox" | "list";

const SIZE = {
  sm: "py-10",
  md: "py-16",
  lg: "py-24",
};

const NAMED: Record<NamedIcon, React.ReactNode> = {
  folder: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />,
  search: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />,
  calendar: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />,
  users: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
  chart: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
  inbox: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />,
  list: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />,
};

export default function EmptyState({
  title, description, action, icon, namedIcon = "list", size = "md", inline = false,
}: Props) {
  const iconBox = icon ? (
    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center border-[2px] border-[#0a0a0a] bg-yellow-300 shadow-[3px_3px_0_0_#0a0a0a] text-[#0a0a0a]">
      {icon}
    </div>
  ) : (
    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center border-[2px] border-[#0a0a0a] bg-yellow-300 shadow-[3px_3px_0_0_#0a0a0a]">
      <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {NAMED[namedIcon]}
      </svg>
    </div>
  );

  const content = (
    <>
      {iconBox}
      <p className="text-[15px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-[13px] text-[#0a0a0a]/65 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </>
  );

  if (inline) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-6">
        {content}
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center brutal bg-white text-center ${SIZE[size]}`}>
      {content}
    </div>
  );
}
