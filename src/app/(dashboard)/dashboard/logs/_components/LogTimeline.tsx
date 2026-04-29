import Link from "next/link";
import type { AuditLog } from "@/types/audit";
import { ACTION_META, ENTITY_TYPE_LABELS } from "@/types/audit";

interface Props {
  logs: AuditLog[];
  hasMore: boolean;
  nextCursor: string | null;
}

// ── 날짜 그룹핑 ────────────────────────────────────────────────
function groupByDate(logs: AuditLog[]): [string, AuditLog[]][] {
  const map = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const key = log.createdAt.slice(0, 10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  }
  return [...map.entries()];
}

function formatDateGroup(dateStr: string): string {
  const date  = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const diff  = Math.floor(
    (today.setHours(0,0,0,0) - date.setHours(0,0,0,0)) / 86_400_000,
  );
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function LogTimeline({ logs, hasMore, nextCursor }: Props) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 ring-1 ring-gray-200">
        <svg className="mb-3 h-10 w-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm font-medium text-gray-400">이력이 없습니다</p>
        <p className="mt-1 text-xs text-gray-300">목표를 생성하거나 수정하면 여기에 기록됩니다.</p>
      </div>
    );
  }

  const groups = groupByDate(logs);

  return (
    <div className="space-y-8">
      {groups.map(([date, group]) => (
        <section key={date}>
          {/* 날짜 구분선 */}
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {formatDateGroup(date)}
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* 타임라인 세로선 */}
          <div className="relative space-y-1">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-100" aria-hidden />
            {group.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        </section>
      ))}

      {/* 더 보기 */}
      {hasMore && nextCursor && (
        <LoadMoreButton cursor={nextCursor} />
      )}
    </div>
  );
}

// ── 개별 로그 항목 ────────────────────────────────────────────
function LogEntry({ log }: { log: AuditLog }) {
  const meta        = ACTION_META[log.action];
  const entityLabel = ENTITY_TYPE_LABELS[log.entityType];
  const initials    = getInitials(log.actorEmail);
  const time        = new Date(log.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="relative flex items-start gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
      {/* 액터 아바타 */}
      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 ring-2 ring-white">
        {initials}
        {/* 액션 도트 */}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${meta.dotColor} ring-2 ring-white`} />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* 헤더 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-gray-800 truncate max-w-[180px]" title={log.actorEmail ?? ""}>
            {log.actorEmail ?? "알 수 없는 사용자"}
          </span>
          <ActionBadge action={log.action} />
          <span className="text-sm text-gray-500">
            {entityLabel}{log.entityLabel && (
              <> <span className="font-medium text-gray-700">'{log.entityLabel}'</span></>
            )}
          </span>
        </div>

        {/* 필드 변경 상세 */}
        {log.action === "updated" && log.field && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
            <span className="font-medium text-gray-500">{log.field}</span>
            <ValueChip value={log.oldValue} variant="old" />
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <ValueChip value={log.newValue} variant="new" />
          </div>
        )}

        {log.action === "status_changed" && log.field && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
            <ValueChip value={log.oldValue} variant="old" />
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <ValueChip value={log.newValue} variant="new" />
          </div>
        )}

        {log.action === "created" && log.metadata && Object.keys(log.metadata).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(log.metadata).map(([k, v]) => (
              <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 시각 */}
      <time className="shrink-0 text-xs text-gray-300 pt-0.5">{time}</time>
    </div>
  );
}

// ── 더 보기 버튼 (URL cursor 파라미터 추가) ──────────────────
function LoadMoreButton({ cursor }: { cursor: string }) {
  return (
    <div className="flex justify-center">
      <Link
        href={`?cursor=${encodeURIComponent(cursor)}`}
        scroll={false}
        className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
      >
        더 보기
      </Link>
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────
function ActionBadge({ action }: { action: AuditLog["action"] }) {
  const m = ACTION_META[action];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${m.bgColor} ${m.color}`}>
      {m.label}
    </span>
  );
}

function ValueChip({ value, variant }: { value: string | null; variant: "old" | "new" }) {
  if (value === null) return <span className="italic text-gray-300">없음</span>;
  const cls = variant === "old"
    ? "bg-rose-50 text-rose-600 line-through"
    : "bg-emerald-50 text-emerald-700 font-medium";
  return (
    <span className={`inline-block max-w-[160px] truncate rounded px-1.5 py-0.5 text-xs ${cls}`} title={value}>
      {value}
    </span>
  );
}

function getInitials(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  return local.slice(0, 2).toUpperCase();
}
