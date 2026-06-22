// 리빙 주제전 — 공용 타입·상수·헬퍼
// 주차는 2026-01-07(수)부터 7일 간격. 라벨은 "M월N주차"(시작일 월 기준).

export interface LivingPopup {
  id: string;
  year: number;
  brand: string;
  store: string;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  channel: string | null;     // 리테일(MDM) | 킴스(PDM)
  popupType: string | null;   // 팝업 | 단기
  promo: string | null;
  vendor: string | null;
  sales: number | null;       // 백만
  note: string | null;
  coalition: string | null;   // 연합 주제전 명칭 (같은 지점·주차·연합명 = 합동)
}

export type PopupStatus = "plan" | "live" | "done";

export interface LivingSpace {
  id: string; store: string;
  floor: string | null; place: string | null; areaPyeong: number | null; note: string | null;
}
export type DailyMap = Record<string, { date: string; sales: number }[]>;   // popupId → 일매출(원)

export const CHANNELS = ["리테일(MDM)", "킴스(PDM)"] as const;
export const POPUP_TYPES = ["팝업", "단기"] as const;
export const PROMOS = ["주년감사제", "이득데이", "창립감사제", "MDM", "추석"] as const;

// 그리드 가로축 기본 브랜드 (편집으로 추가 가능)
export const LIVING_BRANDS = [
  "락앤락", "글라스락", "알리페즈", "광인상사", "테팔", "수엔지",
  "하우담", "아르페지오", "커스티", "이브자리", "쿡셀", "몽드블랑",
  "지포트리", "파고", "쿤리쿤", "정인",
] as const;

// 지점 목록 — 입점계획(ATTRACTION_BRANCHES)과 동기화된 41개 직영점.
// 단일 진실원천(SSOT)을 위해 `src/types/attraction.ts`에서 재내보냄.
export { ATTRACTION_BRANCHES as LIVING_STORES } from "@/types/attraction";
import { ATTRACTION_BRANCHES } from "@/types/attraction";

/** 과거 단축형(예: "광명") → canonical("광명점") 매핑.
 *  Why: 기존 living_popup 데이터는 단축형으로 저장되어 있어 그리드 행과 매칭되지 않음.
 *  How to apply: DB 읽은 popup.store / space.store를 화면 그룹핑 키로 쓰기 전에 한번 통과시킴. */
const STORE_ALIAS: Record<string, string> = {
  "수터": "수원터미널점",
  "터미널": "수원터미널점",
  "유성": "대전 유성점",
  "평촌": "평촌2점",
  "천호": "천호2점",
  "울산": "울산점", // 울산점/울산2점 둘 다 있지만 단축형 "울산"은 본점으로 매핑
};

export function normalizeStore(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.trim();
  if (STORE_ALIAS[t]) return STORE_ALIAS[t];
  if ((ATTRACTION_BRANCHES as readonly string[]).includes(t)) return t;
  const withSuffix = `${t}점`;
  if ((ATTRACTION_BRANCHES as readonly string[]).includes(withSuffix)) return withSuffix;
  return t;
}

export interface WeekRow {
  index: number;
  label: string;       // "1월1주차"
  start: string;       // "2026-01-07"
  end: string;         // "2026-01-13"
  rangeText: string;   // "01.07~13"
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 해당 연도의 주차 행 생성 (1월 첫 화요일 다음 수요일 기준 7일 간격) */
export function buildWeeks(year = 2026): WeekRow[] {
  const weeks: WeekRow[] = [];
  const start = new Date(year, 0, 7);          // 2026-01-07
  const monthCount: Record<number, number> = {};
  let cursor = new Date(start);
  let i = 0;
  while (cursor.getFullYear() === year) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    const m = cursor.getMonth() + 1;
    monthCount[m] = (monthCount[m] ?? 0) + 1;
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    const ed = String(end.getDate()).padStart(2, "0");
    const em = String(end.getMonth() + 1).padStart(2, "0");
    const rangeText = end.getMonth() === cursor.getMonth() ? `${mm}.${dd}~${ed}` : `${mm}.${dd}~${em}.${ed}`;
    weeks.push({ index: i, label: `${m}월${monthCount[m]}주차`, start: iso(cursor), end: iso(end), rangeText });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
    i++;
  }
  return weeks;
}

/** 날짜 기준 상태 (today 미지정 시 시스템 오늘) */
export function popupStatus(p: { startDate: string; endDate: string }, today = new Date()): PopupStatus {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const s = new Date(p.startDate).getTime();
  const e = new Date(p.endDate).getTime();
  if (e < t) return "done";
  if (s <= t && e >= t) return "live";
  return "plan";
}

export const STATUS_LABEL: Record<PopupStatus, string> = { plan: "계획", live: "진행 중", done: "실행" };

/** 팝업이 속한 주차 index (시작일이 포함되는 주).
 *  경계 처리: [w.start, w.start+7일) 반개구간 — 다음 주 시작일(수요일)이 이전 주에 함께 매칭되는 off-by-one 방지. */
export function weekIndexOf(p: { startDate: string }, weeks: WeekRow[]): number {
  const s = new Date(p.startDate).getTime();
  const DAY = 86400000;
  for (const w of weeks) {
    const ws = new Date(w.start).getTime();
    if (s >= ws && s < ws + 7 * DAY) return w.index;
  }
  // 1월 첫 주 이전 → 0, 12월 마지막 주 이후 → 마지막 주
  return s < new Date(weeks[0].start).getTime() ? 0 : weeks[weeks.length - 1].index;
}
