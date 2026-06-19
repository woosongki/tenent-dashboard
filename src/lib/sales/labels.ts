// 데이터는 원본 키("기타"/"패션공통") 그대로 유지하고, UI 표시에서만 라벨 매핑·숨김 처리.

const DIVISION_LABEL: Record<string, string> = {
  기타: "라이프스타일",
};

const HIDDEN_CATS: ReadonlySet<string> = new Set(["패션공통"]);

export const displayDivision = (division: string): string =>
  DIVISION_LABEL[division] ?? division;

export const isHiddenCat = (cat: string | null | undefined): boolean =>
  !!cat && HIDDEN_CATS.has(cat);
