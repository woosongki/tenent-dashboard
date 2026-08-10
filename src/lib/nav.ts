// 사용자별 접근 제어 대상 사이드바 메뉴 레지스트리.
// Sidebar(UI 숨김) · 사용자 관리(체크리스트) · layout(경로 차단)이 공유.
// 대시보드 홈(/dashboard)과 사용자 관리는 제어 대상에서 제외.

export interface MenuItem { key: string; label: string; href: string; }

// 입점계획 대상 연도 — 라벨 단일 소스. 27년 전환 시 이 값만 바꾸면 사이드바·nav·페이지
// 라벨이 함께 갱신된다. (연도별 데이터를 실제로 분리해야 하면 attraction_status 에
// plan_year 컬럼을 추가하고 연도로 필터링 — 지금은 라벨 수준의 준비만.)
export const ATTRACTION_PLAN_YEAR = 2026;
export const ATTRACTION_PLAN_LABEL = `입점계획(${String(ATTRACTION_PLAN_YEAR).slice(2)}년)`;

export const CONTROLLABLE_MENUS: MenuItem[] = [
  { key: "sales",         label: "매출분석",       href: "/dashboard/sales" },
  { key: "bcd",           label: "BCD 분석",       href: "/dashboard/bcd" },
  { key: "drilldown",     label: ATTRACTION_PLAN_LABEL, href: "/dashboard/drilldown" },
  { key: "vacancy",       label: "공실해결",       href: "/dashboard/vacancy" },
  { key: "goals",         label: "컨텐츠 풀",      href: "/dashboard/goals" },
  { key: "calendar",      label: "52주 캘린더",    href: "/dashboard/calendar" },
  { key: "living",        label: "리빙 주제전",    href: "/dashboard/living" },
  { key: "floorplans",    label: "전점도면",       href: "/dashboard/floorplans" },
  { key: "branch",        label: "상권분석",       href: "/dashboard/branch" },
  // "verify"(컨텐츠 검증)는 업체미팅 'AI 심층분석'으로 흡수돼 사이드바에서 은퇴 → 접근제어 대상에서 제외.
  // "brand-keyword"(네이버 쇼핑 검색 기반)는 네이버 쇼핑 상품 검색 API가 종료되어 페이지·라우트 제거됨.
  { key: "brand-fit",     label: "브랜드 적합도",  href: "/dashboard/brand-fit" },
  { key: "homeplus",      label: "리테일 지도",    href: "/dashboard/homeplus" },
  { key: "meetings",      label: "업체미팅",       href: "/dashboard/meetings" },
  { key: "contracts",     label: "계약만료 알람",   href: "/dashboard/contracts/expiry" },
];

const VALID_KEYS = new Set(CONTROLLABLE_MENUS.map((m) => m.key));
export const isValidMenuKey = (k: string): boolean => VALID_KEYS.has(k);

/** 경로(pathname, 쿼리 제외)에 해당하는 메뉴 key. 가장 구체적(긴 href) 우선. */
export function menuKeyForPath(pathname: string): string | null {
  const m = [...CONTROLLABLE_MENUS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((x) => pathname === x.href || pathname.startsWith(x.href + "/"));
  return m?.key ?? null;
}
