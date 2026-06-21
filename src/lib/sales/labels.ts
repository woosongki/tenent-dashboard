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

// ── "그 외" 분리 브랜드 ────────────────────────────────────────
// 매출 집계/노출에서 본류와 분리해 별도 "그 외" 탭에 모으는 브랜드들.
// (모두 라이프스타일 부문이지만 운영성격이 달라 본 수치에 섞이지 않게 격리)
export const OTHERS_KEY = "그외";
export const OTHERS_LABEL = "그 외";

const OTHERS_EXACT: ReadonlySet<string> = new Set(["엠페스트", "코코몽키즈랜드", "이키즈랜드"]);

/** 그 외 분리 대상 브랜드 판별 — 괄호/영문 표기 차이에 관용적, '소극장 마니마니'(별개 브랜드)는 제외 */
export const isOthersBrand = (brand: string | null | undefined): boolean => {
  if (!brand) return false;
  const b = brand.trim();
  if (OTHERS_EXACT.has(b)) return true;
  if (b.startsWith("문화센터")) return true;     // 문화센터(CULTURECENTER)
  if (b.startsWith("소극장(")) return true;       // 소극장(LITTLETHEATER) — '소극장 마니마니' 제외
  return false;
};
