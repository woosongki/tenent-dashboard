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
          className="ml-auto h-8 w-64 rounded-lg border border-[#e8ecf0] bg-white px-3 text-[12px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-[13px]">
            <thead className="text-[11px] tracking-tight text-slate-500 bg-[#f8fafc] border-b border-[#f1f5f9]">
              <tr>
                <th className="text-left py-2 px-3 font-medium">사용자</th>
                <th className="text-left py-2 px-3 font-medium w-24">권한</th>
                <th className="text-left py-2 px-3 font-medium w-28">상태</th>
                <th className="text-left py-2 px-3 font-medium">처리 정보</th>
                <th className="text-right py-2 px-3 font-medium w-48">관리</th>
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
                filtered.map((r) => <UserRowItem key={r.id} row={r} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserRowItem({ row }: { row: UserRow }) {
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

  return (
    <tr className={`border-b border-[#f8fafc] last:border-0 hover:bg-slate-50/60 ${pending ? "opacity-50" : ""}`}>
      <td className="py-2 px-3">
        <div className="font-medium text-slate-900 break-all">
          {row.email}
          {row.isMe && (
            <span className="ml-1.5 text-[10px] text-violet-600">(나)</span>
          )}
        </div>
        {row.fullName && <div className="text-[11px] text-slate-500">{row.fullName}</div>}
        <div className="text-[10px] text-slate-400">가입 {fmtDate(row.createdAt)}</div>
      </td>
      <td className="py-2 px-3">
        {row.role ? (
          <Badge tone={ROLE_TONE[row.role]} size="xs">
            <span className="font-semibold">{row.role}</span>
          </Badge>
        ) : (
          <span className="text-[10px] text-slate-400">조직 미배정</span>
        )}
      </td>
      <td className="py-2 px-3">
        <Badge tone={status.tone} size="sm" variant="dot">{status.label}</Badge>
      </td>
      <td className="py-2 px-3 text-[11px] text-slate-500">
        {row.isApproved && row.approvedAt && <>승인 {fmtDate(row.approvedAt)}</>}
        {!row.isApproved && row.rejectedAt && (
          <>
            거부 {fmtDate(row.rejectedAt)}
            {row.rejectionReason && (
              <div className="text-[10px] text-rose-600 truncate max-w-[260px]" title={row.rejectionReason}>
                사유: {row.rejectionReason}
              </div>
            )}
          </>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        <div className="inline-flex items-center gap-1">
          {!row.isApproved && (
            <button
              type="button"
              onClick={onApprove}
              disabled={pending || row.isMe}
              className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              승인
            </button>
          )}
          {row.isApproved && !row.isMe && (
            <button
              type="button"
              onClick={onRevoke}
              disabled={pending}
              className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              승인 박탈
            </button>
          )}
          {!row.isApproved && !row.rejectedAt && (
            <button
              type="button"
              onClick={onReject}
              disabled={pending || row.isMe}
              className="text-[11px] px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
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
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white border-[#e8ecf0] text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
