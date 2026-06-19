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

// 이랜드리테일 41개 직영점 (src/data/homeplus.ts ELAND_STORES 기준)
// 기존 "전호2점" → "천호2점" 오타 수정. "동수원" / "대전 유성점"은
// 노션 sync 결과와 일치시켜 그대로 유지(canonical: "동수원점" / "NC대전유성점").
export const ATTRACTION_BRANCHES = [
  "강남점", "중계점", "불광점", "야탑점", "산본점", "분당점", "덕천점", "고잔점", "강서점",
  "천호2점", "송파점", "평촌2점", "평택점", "안양점", "창원점", "수성점", "해운대점", "부천점",
  "부평점", "동수원", "일산점", "인천점", "울산2점", "강북점", "광명점", "대전 유성점", "울산점",
  "경산점", "충장점", "부산대점", "중앙로역점", "순천점", "청주점", "신구로점",
  "광주역점", "수원터미널점", "엑스코점", "전주점", "괴정점", "구미점", "쇼핑점",
] as const;

export const ATTRACTION_FLOORS = [
  "B4", "B2", "B1", "1F", "2F", "3F", "4F", "5F", "6F", "7F", "8F", "9F", "10F", "11F", "12F", "-",
] as const;
