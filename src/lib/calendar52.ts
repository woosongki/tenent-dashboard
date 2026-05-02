// 이랜드리테일 팝업 52주(48주) 캘린더 — 원본: 이랜드리테일_팝업_52주_캘린더_v4.html
// scripts/import-calendar52.mjs 로 src/data/calendar52.json 생성.
//
// 컨텐츠 풀(팝업 컨텍판)과 자동 매칭:
// - 각 주차의 popups[].text 안에서 컨텍판 브랜드명이 등장하면
//   그 옆에 진행단계 뱃지를 표시할 수 있도록 매칭 인덱스를 빌드.

import data from "@/data/calendar52.json";
import seasonsData from "@/data/calendar52-seasons.json";
import { getPopupContacts, type PopupContact } from "./popupContacts";

export type Intensity = "high" | "mid" | "low";

export interface CalSection { label: string; color?: string; text: string }
export interface CalEvent   { label: string; text: string }

export interface CalendarWeek {
  index: number;
  month: string;     // "1월"
  season: string;    // "겨울방학"
  monthKw: string;   // 월 키워드 (1월 한정 동일하게 4주)
  weekNo: string;    // "1"|"2"|"3"|"4"
  concept: string;   // 컨셉
  grade: string;     // "★★★"
  intensity: Intensity;
  others: CalSection[];   // 타유통
  extEvents: CalEvent[];  // 박람회/축제/온라인
  popups: CalSection[];   // 팝업 후보
  item: string;
  hotsauce: string;
  bestCat: string;
}

export interface SeasonStyle { bg: string; tx: string; mb: string }

interface Payload {
  source: string;
  importedAt: string;
  count: number;
  records: CalendarWeek[];
}

const payload = data as Payload;
const seasons = seasonsData as Record<string, SeasonStyle>;

export function getCalendar52(): CalendarWeek[] {
  return payload.records;
}

export function getCalendar52Meta() {
  return { source: payload.source, importedAt: payload.importedAt, count: payload.count };
}

export function getSeasonStyle(name: string): SeasonStyle {
  return seasons[name] ?? { bg: "#334155", tx: "#cbd5e1", mb: "rgba(51,65,85,.08)" };
}

// ── 컨텐츠 풀 매칭 ────────────────────────────────────────
// 캘린더 카드의 popup 텍스트에서 컨텍판 브랜드명을 찾아
// {weekIndex → matched contacts[]} 인덱스를 만든다.
export interface CalendarMatch {
  contact: PopupContact;
  /** popup section의 어느 문자열에서 매칭됐는지(중복 표시용) */
  hitIn: string;
}

export function buildCalendarPopupMatches(): Record<number, CalendarMatch[]> {
  const contacts = getPopupContacts();
  // 매칭 정확도를 위해 2자 이상 brand만, 또 매우 흔한 단어 컷
  const STOPWORDS = new Set(["팝업", "스토어", "프로젝트", "브랜드", "판매", "체험", "전시", "부스", "행사"]);
  const candidates = contacts
    .map((c) => ({ c, key: (c.brand ?? "").trim() }))
    .filter((x) => x.key.length >= 2 && !STOPWORDS.has(x.key));

  const result: Record<number, CalendarMatch[]> = {};
  for (const w of payload.records) {
    const seen = new Set<number>();
    const matches: CalendarMatch[] = [];
    const haystack = w.popups.map((p) => p.text).join("\n");
    if (!haystack) continue;
    for (const { c, key } of candidates) {
      if (seen.has(c.no)) continue;
      // 단순 includes — 빠르고 충분히 정확. 영문은 대소문자 무시.
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

export const INTENSITY_COLOR: Record<Intensity, { dot: string; bg: string; text: string }> = {
  high: { dot: "bg-rose-500",    bg: "bg-rose-50",    text: "text-rose-700" },
  mid:  { dot: "bg-amber-400",   bg: "bg-amber-50",   text: "text-amber-700" },
  low:  { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
};
