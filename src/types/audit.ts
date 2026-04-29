export type AuditAction = "created" | "updated" | "deleted" | "status_changed";
export type AuditEntityType = "goal" | "member" | "invitation" | "organization";

export interface AuditLog {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string | null;
  action: AuditAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogPage {
  logs: AuditLog[];
  nextCursor: string | null; // ISO timestamp — 다음 페이지 시작점
  hasMore: boolean;
}

export interface AuditFilters {
  entityType?: AuditEntityType | "all";
  action?: AuditAction | "all";
  actorId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  cursor?: string;   // ISO timestamp
}

export const PAGE_SIZE = 30;

// ── 표시용 메타 ──────────────────────────────────────────────

export const ACTION_META: Record<
  AuditAction,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  created:        { label: "생성",    color: "text-emerald-700", bgColor: "bg-emerald-50",  dotColor: "bg-emerald-400" },
  updated:        { label: "수정",    color: "text-indigo-700",  bgColor: "bg-indigo-50",   dotColor: "bg-indigo-400"  },
  deleted:        { label: "삭제",    color: "text-rose-700",    bgColor: "bg-rose-50",     dotColor: "bg-rose-400"    },
  status_changed: { label: "상태변경", color: "text-violet-700", bgColor: "bg-violet-50",  dotColor: "bg-violet-400"  },
};

export const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  goal:         "목표",
  member:       "멤버",
  invitation:   "초대",
  organization: "조직",
};
