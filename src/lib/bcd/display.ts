// BCD 화면 표기 공용 상수 — 라이브 탭(BrandConceptClient)과 HTML 내보내기(export-html)가
// 같은 등급 순서·색·기준 설명을 쓰도록 단일화. 둘 중 한쪽만 고쳐 설명이 어긋나는 일을 막는다.

export const GRADE_ORDER = ["A", "B+", "B", "C", "N", "H", "미평가"] as const;
export type Grade = (typeof GRADE_ORDER)[number];

/** 등급별 막대·강조 색(hex) — 인라인 style·standalone HTML 공용. */
export const GRADE_BAR: Record<string, string> = {
  "A": "#7c3aed",
  "B+": "#0d9e6e",
  "B": "#2b6cb0",
  "C": "#b7791f",
  "N": "#e53e3e",
  "H": "#0a0a0a",
  "미평가": "#94a3b8",
};

export const SCOPE_LABEL: Record<string, string> = { excluded: "제외(X)", knockout: "거래불가(H)" };

/** C1~C8 기준 설명 — 담당자가 아닌 사람도 보고 작업할 수 있게. */
export const CRITERIA_HELP: { code: string; title: string; what: string; how: string; source: string }[] = [
  { code: "C1", title: "벤치마크 유통 입점률", what: "핵심 벤치마크 유통(더현대·스타필드·롯데월드몰 등 10곳) 중 몇 곳에 입점했는지.", how: "4곳↑=25 · 2~3곳=20 · 1곳=10 · 0곳=0점", source: "수동 — 콘솔 'C1 입점 편집'에서 유통 체크" },
  { code: "C2", title: "핫플 상권 입점 수", what: "전국 핵심상권(50여 곳) 중 매장이 있는 상권 수(상권 단위).", how: "절대기준 20곳↑=상 · 5곳↑=중 (배점 15)", source: "카카오맵 수집(자동)" },
  { code: "C3", title: "전국 매장 수", what: "브랜드의 전국 매장 수.", how: "같은 중분류 내 백분위 — 상위 30%↑=상 · 상위 70%↑=중 (배점 10)", source: "카카오맵 수집(자동, 표본 최대 45)" },
  { code: "C4", title: "검색량 수준", what: "월간 검색량(절대치, PC+모바일).", how: "같은 중분류 내 백분위 (배점 18)", source: "네이버 검색광고(자동)" },
  { code: "C5", title: "검색량 추세", what: "전년 동월 대비 검색량 증감률.", how: "구간 — +20%↑=12 · 0~20%=9 · −20~0%=5 · −20%↓=0점", source: "네이버 데이터랩(자동)" },
  { code: "C6", title: "매장 수 순증률", what: "직전 수집 대비 매장 증가율.", how: "절대기준 (배점 10). 2회차 수집부터 실측, 그전엔 기본값 5", source: "카카오맵 수집(자동)" },
  { code: "C7", title: "온라인 채널 전개(가점)", what: "자사몰·오픈마켓 등 온라인 판매 채널 수.", how: "가점 최대 5점(기본 100점 밖). 온라인 미적용 브랜드는 제외", source: "수동" },
  { code: "C8", title: "브랜드 감도", what: "담당자 정성 평가(트렌드·브랜드력).", how: "상(10)/중(5)/하(0) 또는 0~10 직접 (배점 10)", source: "수동 — 지표 입력" },
];
