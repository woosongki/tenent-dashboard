export interface AttractionRow {
  id: string;
  brand_name: string;
  branch: string | null;
  floor: string | null;
  category: string | null;
  size_pyeong: number | null;
  manager: string | null;
  is_completed: boolean;
  memo: string | null;
  notion_url: string | null;
  created_at: string;
}

export const ATTRACTION_CATEGORIES = [
  "스포츠", "키즈카페", "팬시/굿즈", "빅컨텐츠", "리빙", "뷰티", "체험", "가전", "기타",
] as const;
