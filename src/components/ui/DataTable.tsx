/**
 * Brutalist 데이터 테이블 wrapper.
 */

import EmptyState from "./EmptyState";

interface Props {
  children: React.ReactNode;
  minWidth?: number;
  zebra?: boolean;
  card?: boolean;
  className?: string;
  empty?: React.ReactNode;
}

export default function DataTable({
  children, minWidth = 720, zebra = true, card = true, className = "", empty,
}: Props) {
  const wrap = card ? "brutal bg-white" : "";
  const tableCls = [
    "w-full text-[13px]",
    zebra ? "[&_tbody_tr:nth-child(even)]:bg-[#FAF7EC]/60" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={`${wrap} ${className}`}>
      <div className="overflow-x-auto">
        <table className={tableCls} style={minWidth ? { minWidth } : undefined}>
          {children}
        </table>
      </div>
      {empty}
    </div>
  );
}

export function TH({
  children, className = "", align = "left",
}: { children: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-3 py-3 ${alignCls} text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

export function TD({
  children, className = "", align = "left", numeric = false,
}: { children: React.ReactNode; className?: string; align?: "left" | "right" | "center"; numeric?: boolean }) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const numCls = numeric ? "tabular-nums font-mono" : "";
  return (
    <td className={`px-3 py-3 ${alignCls} ${numCls} ${className}`}>
      {children}
    </td>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-[#F1ECDB] border-b-[2px] border-[#0a0a0a]">
      <tr>{children}</tr>
    </thead>
  );
}

export function TBodyEmpty({
  colSpan, message = "표시할 데이터가 없습니다.",
}: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState title={message} namedIcon="inbox" size="sm" inline />
      </td>
    </tr>
  );
}
