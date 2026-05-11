"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { approveUser, rejectUser, revokeApproval } from "../_actions";

export interface UserRow {
  id: string;
  email: string;
  fullName: string | null;
  isApproved: boolean;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  role: "owner" | "admin" | "member" | null;
  isMe: boolean;
}

type Filter = "all" | "pending" | "approved" | "rejected";

const ROLE_TONE = {
  owner:  "brand",
  admin:  "info",
  member: "neutral",
} as const;

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function UserApprovalTable({ rows }: { rows: UserRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "pending"  && (r.isApproved || r.rejectedAt)) return false;
      if (filter === "approved" && !r.isApproved) return false;
      if (filter === "rejected" && (r.isApproved || !r.rejectedAt)) return false;
      if (qNorm) {
        const hay = `${r.email} ${r.fullName ?? ""}`.toLowerCase();
        if (!hay.includes(qNorm)) return false;
      }
      return true;
    });
  }, [rows, filter, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={filter === "all"}      onClick={() => setFilter("all")}>전체 {rows.length}</Chip>
        <Chip active={filter === "pending"}  onClick={() => setFilter("pending")}>대기 {rows.filter((r) => !r.isApproved && !r.rejectedAt).length}</Chip>
        <Chip active={filter === "approved"} onClick={() => setFilter("approved")}>승인 {rows.filter((r) => r.isApproved).length}</Chip>
        <Chip active={filter === "rejected"} onClick={() => setFilter("rejected")}>거부 {rows.filter((r) => !r.isApproved && r.rejectedAt).length}</Chip>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일·이름 검색"
          className="ml-auto h-9 w-64 border-[2px] border-[#0a0a0a] bg-white px-3 text-[12px] font-medium placeholder:text-[#0a0a0a]/40 shadow-[2px_2px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_0_#0a0a0a] transition-all"
        />
      </div>

      <div className="overflow-hidden brutal bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-[13px]">
            <thead className="bg-[#F1ECDB] border-b-[2px] border-[#0a0a0a]">
              <tr>
                <TH>사용자</TH>
                <TH className="w-24">권한</TH>
                <TH className="w-28">상태</TH>
                <TH>처리 정보</TH>
                <TH align="right" className="w-48">관리</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="조건에 맞는 사용자가 없습니다"
                      description="필터를 초기화하거나 다른 검색어를 시도해 보세요."
                      namedIcon="users"
                      size="sm"
                      inline
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => <UserRowItem key={r.id} row={r} zebra={i % 2 === 1} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TH({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-3 py-3 ${a} text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function UserRowItem({ row, zebra = false }: { row: UserRow; zebra?: boolean }) {
  const [pending, start] = useTransition();

  function onApprove() {
    start(async () => {
      const res = await approveUser(row.id);
      if (!res.ok) toast.error(res.error);
      else toast.success(`${row.email} 승인됨`);
    });
  }

  function onReject() {
    const reason = prompt("거부 사유를 입력해 주세요 (사용자에게 표시됩니다):", "")?.trim();
    if (reason === undefined) return;
    start(async () => {
      const res = await rejectUser(row.id, reason || "사유 없음");
      if (!res.ok) toast.error(res.error);
      else toast.success(`${row.email} 거부됨`);
    });
  }

  function onRevoke() {
    if (!confirm(`${row.email}의 승인을 박탈할까요?\n해당 사용자는 즉시 대시보드 접근이 차단됩니다.`)) return;
    start(async () => {
      const res = await revokeApproval(row.id);
      if (!res.ok) toast.error(res.error);
      else toast.success(`${row.email} 승인 박탈됨`);
    });
  }

  const status: { label: string; tone: "success" | "danger" | "warning" } = row.isApproved
    ? { label: "승인됨", tone: "success" }
    : row.rejectedAt
      ? { label: "거부됨", tone: "danger" }
      : { label: "대기 중", tone: "warning" };

  const bgCls = zebra ? "bg-[#FAF7EC]/40" : "bg-white";

  return (
    <tr className={`border-b border-[#0a0a0a]/10 last:border-0 ${bgCls} hover:bg-yellow-100 ${pending ? "opacity-50" : ""}`}>
      <td className="py-3 px-3">
        <div className="font-extrabold text-[#0a0a0a] break-all">
          {row.email}
          {row.isMe && (
            <span className="ml-1.5 inline-block border-[1.5px] border-[#0a0a0a] bg-violet-500 px-1 py-0 text-[9px] font-extrabold uppercase tracking-wider text-white">나</span>
          )}
        </div>
        {row.fullName && <div className="text-[11px] font-medium text-[#0a0a0a]/65">{row.fullName}</div>}
        <div className="font-mono text-[10px] font-bold text-[#0a0a0a]/50 mt-0.5">가입 {fmtDate(row.createdAt)}</div>
      </td>
      <td className="py-3 px-3">
        {row.role ? (
          <Badge tone={ROLE_TONE[row.role]} size="xs">
            {row.role}
          </Badge>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">조직 미배정</span>
        )}
      </td>
      <td className="py-3 px-3">
        <Badge tone={status.tone} size="sm" variant="dot">{status.label}</Badge>
      </td>
      <td className="py-3 px-3">
        {row.isApproved && row.approvedAt && (
          <p className="font-mono text-[11px] font-medium text-[#0a0a0a]/65">승인 {fmtDate(row.approvedAt)}</p>
        )}
        {!row.isApproved && row.rejectedAt && (
          <>
            <p className="font-mono text-[11px] font-medium text-[#0a0a0a]/65">거부 {fmtDate(row.rejectedAt)}</p>
            {row.rejectionReason && (
              <div className="mt-1 text-[10px] font-bold text-rose-700 truncate max-w-[260px]" title={row.rejectionReason}>
                사유: {row.rejectionReason}
              </div>
            )}
          </>
        )}
      </td>
      <td className="py-3 px-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          {!row.isApproved && (
            <button
              type="button"
              onClick={onApprove}
              disabled={pending || row.isMe}
              className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 border-[2px] border-[#0a0a0a] bg-emerald-400 text-emerald-950 shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#0a0a0a] disabled:opacity-50 transition-all"
            >
              승인
            </button>
          )}
          {row.isApproved && !row.isMe && (
            <button
              type="button"
              onClick={onRevoke}
              disabled={pending}
              className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-yellow-300 disabled:opacity-50 transition-colors"
            >
              승인 박탈
            </button>
          )}
          {!row.isApproved && !row.rejectedAt && (
            <button
              type="button"
              onClick={onReject}
              disabled={pending || row.isMe}
              className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 border-[2px] border-[#0a0a0a] bg-rose-500 text-white shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#0a0a0a] disabled:opacity-50 transition-all"
            >
              거부
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function Chip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] transition-all ${
        active
          ? "bg-[#0a0a0a] text-white shadow-[2px_2px_0_0_#0a0a0a]"
          : "bg-white text-[#0a0a0a] hover:bg-yellow-300"
      }`}
    >
      {children}
    </button>
  );
}
