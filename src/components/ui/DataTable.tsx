/**
 * 보고용 데이터 테이블 wrapper.
 * - thead: solid 배경 + 11px bold uppercase
 * - body: zebra striping + hover
 * - 가로 스크롤 컨테이너 + min-w 옵션
 *
 * 자식으로 <thead>/<tbody> 직접 받거나 columns/rows props로 자동 렌더 모두 지원.
 */

import EmptyState from "./EmptyState";

interface ChildrenProps {
  children: React.ReactNode;
  /** 최소 너비 (모바일 가로스크롤용) */
  minWidth?: number;
  /** zebra striping (기본 on) */
  zebra?: boolean;
  /** rounded card 컨테이너 (기본 on) */
  card?: boolean;
  className?: string;
  /** 빈 상태일 때 노출할 컴포넌트 */
  empty?: React.ReactNode;
}

export default function DataTable({
  children, minWidth = 720, zebra = true, card = true, className = "", empty,
}: ChildrenProps) {
  const wrap = card
    ? "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]"
    : "";
  const tableCls = [
    "w-full text-[13px]",
    `min-w-[${minWidth}px]`,
    zebra ? "[&_tbody_tr:nth-child(even)]:bg-slate-50/40" : "",
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

/** 표 thead 헤더 셀 — 보고용 톤 */
export function TH({
  children, className = "", align = "left",
}: { children: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-3 py-2.5 ${alignCls} text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

/** 표 tbody 셀 */
export function TD({
  children, className = "", align = "left", numeric = false,
}: { children: React.ReactNode; className?: string; align?: "left" | "right" | "center"; numeric?: boolean }) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const numCls = numeric ? "tabular-nums" : "";
  return (
    <td className={`px-3 py-2.5 ${alignCls} ${numCls} ${className}`}>
      {children}
    </td>
  );
}

/** thead 행 — 일관된 배경/테두리 */
export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-slate-50/80 border-b border-slate-200">
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
