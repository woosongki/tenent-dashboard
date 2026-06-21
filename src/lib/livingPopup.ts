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

// 자주 쓰는 지점 (입력 편의용 — 자유 입력도 허용)
export const LIVING_STORES = [
  "광명", "분당", "괴정", "덕천", "해운대", "신구로", "동수원", "인천",
  "송파", "야탑", "평촌", "울산", "고잔", "터미널", "유성", "수성",
  "평택", "중계", "쇼핑", "천호", "부산대", "산본", "순천", "부천",
  "창원", "경산", "일산", "청주", "충장", "광주역", "부평", "수터", "안양",
] as const;

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

/** 팝업이 속한 주차 index (시작일이 포함되는 주) */
export function weekIndexOf(p: { startDate: string }, weeks: WeekRow[]): number {
  const s = new Date(p.startDate).getTime();
  for (const w of weeks) {
    if (s >= new Date(w.start).getTime() && s <= new Date(w.end).getTime() + 86400000) return w.index;
  }
  // 1월 첫 주 이전이면 0
  return 0;
}
