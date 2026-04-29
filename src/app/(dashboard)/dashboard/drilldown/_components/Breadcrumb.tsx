import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumb({ crumbs }: Props) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          {c.href ? (
            <Link href={c.href} className="hover:text-gray-900 transition-colors">
              {c.label}
            </Link>
          ) : (
            <span className="font-semibold text-gray-900">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
