import { createClient } from "@/lib/supabase/server";
import type { AuditLog, AuditLogPage, AuditFilters } from "@/types/audit";
import { PAGE_SIZE } from "@/types/audit";

function rowToLog(r: Record<string, unknown>): AuditLog {
  return {
    id:             r.id as string,
    organizationId: r.organization_id as string | null,
    actorId:        r.actor_id as string | null,
    actorEmail:     r.actor_email as string | null,
    entityType:     r.entity_type as AuditLog["entityType"],
    entityId:       r.entity_id as string,
    entityLabel:    r.entity_label as string | null,
    action:         r.action as AuditLog["action"],
    field:          r.field as string | null,
    oldValue:       r.old_value as string | null,
    newValue:       r.new_value as string | null,
    metadata:       (r.metadata ?? {}) as Record<string, unknown>,
    createdAt:      r.created_at as string,
  };
}

export async function getAuditLogs(
  orgId: string,
  filters: AuditFilters = {},
): Promise<AuditLogPage> {
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, organization_id, actor_id, actor_email, entity_type, entity_id, entity_label, action, field, old_value, new_value, metadata, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1); // +1 로 hasMore 판단

  if (filters.entityType && filters.entityType !== "all") {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters.action && filters.action !== "all") {
    query = query.eq("action", filters.action);
  }
  if (filters.actorId) {
    query = query.eq("actor_id", filters.actorId);
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00Z`);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59Z`);
  }
  // cursor 기반 페이지네이션: cursor 이전 시각의 데이터
  if (filters.cursor) {
    query = query.lt("created_at", filters.cursor);
  }

  const { data, error } = await query;
  if (error || !data) return { logs: [], nextCursor: null, hasMore: false };

  const hasMore = data.length > PAGE_SIZE;
  const rows    = hasMore ? data.slice(0, PAGE_SIZE) : data;
  const logs    = rows.map(rowToLog);

  return {
    logs,
    nextCursor: hasMore ? logs[logs.length - 1].createdAt : null,
    hasMore,
  };
}

/** 조직 내 편집자 목록 (필터 드롭다운용) */
export async function getAuditActors(
  orgId: string,
): Promise<{ id: string; email: string }[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("audit_logs")
    .select("actor_id, actor_email")
    .eq("organization_id", orgId)
    .not("actor_id", "is", null)
    .order("created_at", { ascending: false });

  if (!data) return [];

  // 중복 제거
  const seen = new Set<string>();
  return data
    .filter((r) => r.actor_id && !seen.has(r.actor_id) && seen.add(r.actor_id))
    .map((r) => ({ id: r.actor_id as string, email: r.actor_email as string }));
}
