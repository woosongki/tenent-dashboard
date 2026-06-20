// 데이터는 원본 키("기타"/"패션공통"/"잡화(특정매입)" 등) 그대로 유지하고,
// UI 표시에서만 라벨 매핑·순서·숨김 처리.

const DIVISION_LABEL: Record<string, string> = {
  기타: "라이프스타일",
};

// 부문 표시 순서 (패션 → F&B → 라이프스타일)
const DIVISION_ORDER = ["패션", "F&B", "기타"];

const HIDDEN_CATS: ReadonlySet<string> = new Set(["패션공통"]);

// 복종(패션) 표시명 — 원본 cat → 표시 라벨
const CAT_LABEL: Record<string, string> = {
  "잡화(특정매입)": "트렌드(잡화)",
  "영캐쥬얼(특정)2001": "영캐주얼",
  "여성의류(특정)NC": "여성",
  "남성의류(특정매입)": "신사",
  "스포츠(특정)NC": "스포츠",
  "캐쥬얼(특정매입)": "캐주얼",
  "아동의류(특정매입)": "아동",
};

// 복종 표시 순서
const CAT_ORDER = [
  "잡화(특정매입)", "영캐쥬얼(특정)2001", "여성의류(특정)NC",
  "남성의류(특정매입)", "스포츠(특정)NC", "캐쥬얼(특정매입)", "아동의류(특정매입)",
];

export const displayDivision = (division: string): string =>
  DIVISION_LABEL[division] ?? division;

export const divisionRank = (division: string): number => {
  const i = DIVISION_ORDER.indexOf(division);
  return i < 0 ? 999 : i;
};

export const isHiddenCat = (cat: string | null | undefined): boolean =>
  !!cat && HIDDEN_CATS.has(cat);

export const displayCat = (cat: string | null | undefined): string =>
  cat ? (CAT_LABEL[cat] ?? cat) : "";

export const catRank = (cat: string | null | undefined): number => {
  if (!cat) return 999;
  const i = CAT_ORDER.indexOf(cat);
  return i < 0 ? 998 : i;
};
