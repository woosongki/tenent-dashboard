import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface RecentMeetingItem {
  id: string;
  brand: string;
  company: string | null;
  sessionCount: number;
  lastSessionAt: string | null; // held_at (YYYY-MM-DD) 또는 null
  lastSessionIndex: number | null;
  stage: string;
  createdAt: string;
}

/**
 * 사이드바 · 랜딩 리스트용 — 조직의 모든 업체를 "최근 세션" 우선으로 정렬.
 * 세션이 없는 업체는 created_at 기준으로 뒤에 붙음.
 */
export async function getRecentMeetings(
  orgId: string,
  limit = 30
): Promise<RecentMeetingItem[]> {
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("vendor_meetings")
    .select("id,brand,company,stage,created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = meetings ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id as string);
  const { data: sessions } = await supabase
    .from("vendor_meeting_sessions")
    .select("meeting_id,session_index,held_at")
    .in("meeting_id", ids)
    .order("held_at", { ascending: false });

  // meeting_id → { count, last session } 집계
  const agg = new Map<string, { count: number; last: string | null; lastIdx: number | null }>();
  for (const s of sessions ?? []) {
    const mid = s.meeting_id as string;
    const held = s.held_at as string;
    const idx = s.session_index as number;
    const cur = agg.get(mid);
    if (!cur) {
      agg.set(mid, { count: 1, last: held, lastIdx: idx });
    } else {
      cur.count += 1;
      // 정렬이 held desc라 첫 만남이 최신 — 나머지는 카운트만.
      if (!cur.last || held > cur.last) {
        cur.last = held;
        cur.lastIdx = idx;
      } else if (held === cur.last && idx > (cur.lastIdx ?? 0)) {
        cur.lastIdx = idx;
      }
    }
  }

  const items: RecentMeetingItem[] = rows.map((r) => {
    const a = agg.get(r.id as string);
    return {
      id: r.id as string,
      brand: r.brand as string,
      company: (r.company as string | null) ?? null,
      sessionCount: a?.count ?? 0,
      lastSessionAt: a?.last ?? null,
      lastSessionIndex: a?.lastIdx ?? null,
      stage: r.stage as string,
      createdAt: r.created_at as string,
    };
  });

  // 최근 세션 우선, 세션 없는 건 뒤로. 동률이면 createdAt 최신.
  items.sort((a, b) => {
    if (a.lastSessionAt && b.lastSessionAt) {
      return a.lastSessionAt < b.lastSessionAt ? 1 : a.lastSessionAt > b.lastSessionAt ? -1 : 0;
    }
    if (a.lastSessionAt) return -1;
    if (b.lastSessionAt) return 1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  return items;
}
