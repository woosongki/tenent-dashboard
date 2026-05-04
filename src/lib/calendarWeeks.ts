// DB(calendar52_weeks) 기반 52주 캘린더 조회/매칭.
// DB 행이 비어 있으면 JSON 시드 데이터 fallback.

import { createClient } from "@/lib/supabase/server";
import { getCalendar52, type CalendarWeek } from "@/lib/calendar52";
import { getPopupContacts, type PopupContact } from "@/lib/popupContacts";

interface Row {
  week_index: number;
  month: string;
  season: string;
  month_kw: string | null;
  week_no: string | null;
  concept: string | null;
  grade: string | null;
  intensity: "high" | "mid" | "low" | null;
  others: unknown;
  ext_events: unknown;
  popups: unknown;
  item: string | null;
  hotsauce: string | null;
  best_cat: string | null;
}

function rowToDomain(r: Row): CalendarWeek {
  const others = Array.isArray(r.others) ? (r.others as { label: string; color?: string; text: string }[]) : [];
  const ext    = Array.isArray(r.ext_events) ? (r.ext_events as { label: string; text: string }[]) : [];
  const pops   = Array.isArray(r.popups) ? (r.popups as { label: string; color?: string; text: string }[]) : [];
  return {
    index:     r.week_index,
    month:     r.month,
    season:    r.season,
    monthKw:   r.month_kw ?? "",
    weekNo:    r.week_no ?? "",
    concept:   r.concept ?? "",
    grade:     r.grade ?? "",
    intensity: r.intensity ?? "mid",
    others,
    extEvents: ext,
    popups:    pops,
    item:      r.item ?? "",
    hotsauce:  r.hotsauce ?? "",
    bestCat:   r.best_cat ?? "",
  };
}

/** 조직별 캘린더 주차 조회 (DB 우선, 없으면 정적 JSON fallback) */
export async function getCalendarWeeksForOrg(organizationId: string | null): Promise<{
  weeks: CalendarWeek[];
  source: "db" | "static";
}> {
  if (!organizationId) {
    return { weeks: getCalendar52(), source: "static" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar52_weeks")
    .select("week_index, month, season, month_kw, week_no, concept, grade, intensity, others, ext_events, popups, item, hotsauce, best_cat")
    .eq("organization_id", organizationId)
    .order("week_index", { ascending: true });

  if (error || !data || data.length === 0) {
    return { weeks: getCalendar52(), source: "static" };
  }
  return { weeks: (data as Row[]).map(rowToDomain), source: "db" };
}

/** 컨텍판 자동 매칭 — calendar weeks 인자 기반 */
export interface CalendarMatch { contact: PopupContact; hitIn: string }

export function buildPopupMatches(weeks: CalendarWeek[]): Record<number, CalendarMatch[]> {
  const contacts = getPopupContacts();
  const STOPWORDS = new Set(["팝업","스토어","프로젝트","브랜드","판매","체험","전시","부스","행사"]);
  const candidates = contacts
    .map((c) => ({ c, key: (c.brand ?? "").trim() }))
    .filter((x) => x.key.length >= 2 && !STOPWORDS.has(x.key));

  const result: Record<number, CalendarMatch[]> = {};
  for (const w of weeks) {
    const seen = new Set<number>();
    const matches: CalendarMatch[] = [];
    const haystack = w.popups.map((p) => p.text).join("\n");
    if (!haystack) continue;
    for (const { c, key } of candidates) {
      if (seen.has(c.no)) continue;
      if (
        haystack.includes(key) ||
        (/^[a-zA-Z0-9 .&-]+$/.test(key) && haystack.toLowerCase().includes(key.toLowerCase()))
      ) {
        seen.add(c.no);
        matches.push({ contact: c, hitIn: key });
      }
    }
    if (matches.length > 0) result[w.index] = matches;
  }
  return result;
}
