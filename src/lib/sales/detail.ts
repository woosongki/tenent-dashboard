// 당월상세/누적상세(OfflineDetailTab)의 순수 계산 — 칩 구성·스코프 선택·지점 피벗·요약·코호트.
// 화면 컴포넌트와 HTML 내보내기(lib/sales/export-detail-html.ts)가 같은 결과를 내도록 한 곳에 둔다.
// DB·React 의존 없음(순수 함수) — 테스트와 서버 양쪽에서 그대로 호출.

import { displayDivision, isHiddenCat, displayCat, catRank, divisionRank, OTHERS_KEY, OTHERS_LABEL } from "./labels";
import type { OffRank, OffOthers, OffSub } from "./queries";
import type { CohortStat } from "./diagnose";

export interface DivSummary { division: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
export interface CatSummary { cat: string; s: number; ps: number; g: number; gpm: number; yoyPct: number }
export type Sel = { type: "cat" | "div"; key: string };
export interface DetailChip { type: "cat" | "div"; key: string; label: string; s: number }

export interface ScopeSummary {
  s: number; ps: number; g: number; gpm: number; yoyPct: number;
  brands: number; closedCount: number;
  dppSales: number; prevDppSales: number; dppSalesGrowthPct: number;
}

/** 선택 칩: 패션 복종("패션공통" 비노출) + 비패션 부문 + '그 외'(항상 마지막). */
export function buildDetailChips(
  divisions: DivSummary[],
  fashionCats: CatSummary[],
  others?: OffOthers | null
): DetailChip[] {
  const fashionChips = fashionCats
    .filter((c) => !isHiddenCat(c.cat))
    .sort((a, b) => catRank(a.cat) - catRank(b.cat))
    .map((c) => ({ type: "cat" as const, key: c.cat, label: displayCat(c.cat) || "(미분류)", s: c.s }));
  const divChips = divisions
    .filter((d) => d.division !== "패션")
    .sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
    .map((d) => ({ type: "div" as const, key: d.division, label: displayDivision(d.division), s: d.s }));
  const othersChip = others && others.brands.length
    ? [{ type: "div" as const, key: OTHERS_KEY, label: OTHERS_LABEL, s: others.total }]
    : [];
  return [...fashionChips, ...divChips, ...othersChip];
}

/** 선택 복종/부문의 브랜드 행. */
export function selectCatRows(sel: Sel, brands: OffRank[], others?: OffOthers | null): OffRank[] {
  if (sel.type === "div" && sel.key === OTHERS_KEY) return others?.detailBrands ?? [];
  return brands.filter((b) => sel.type === "cat"
    ? (b.division === "패션" && b.cat === sel.key)
    : b.division === sel.key);
}

/**
 * 선택 스코프의 지점 피벗(detailBrands → 지점). stSel=null 이면 지점 전체 합계를 그대로.
 * areaDays/prevAreaDays: sub.s / sub.dppSales 로 (평·일)을 역산해 지점 스코프 일평당매출을 재계산.
 */
export function buildStoreData(
  stSel: Sel | null,
  stores: OffRank[],
  brands: OffRank[],
  others?: OffOthers | null
): OffRank[] {
  if (!stSel) return stores;
  if (stSel.type === "div" && stSel.key === OTHERS_KEY) return others?.stores ?? [];
  const selBrands = selectCatRows(stSel, brands, others);
  const m = new Map<string, { s: number; ps: number; g: number; pg: number; areaDays: number; prevAreaDays: number; subs: OffSub[] }>();
  for (const b of selBrands) {
    for (const sub of b.bySub ?? []) {
      let e = m.get(sub.key);
      if (!e) { e = { s: 0, ps: 0, g: 0, pg: 0, areaDays: 0, prevAreaDays: 0, subs: [] }; m.set(sub.key, e); }
      e.s += sub.s; e.ps += sub.ps; e.g += sub.g; e.pg += sub.pg;
      if (sub.dppSales) e.areaDays += sub.s / sub.dppSales;
      if (sub.prevDppSales) e.prevAreaDays += sub.ps / sub.prevDppSales;
      e.subs.push({ ...sub, key: b.key });   // 하위 = 브랜드 (지점 내)
    }
  }
  return [...m.entries()].map(([store, e]) => {
    const dppSales = e.areaDays ? Math.round(e.s / e.areaDays) : 0;
    const prevDppSales = e.prevAreaDays ? Math.round(e.ps / e.prevAreaDays) : 0;
    return {
      key: store, s: e.s, ps: e.ps, g: e.g, pg: e.pg,
      gpm: e.s ? +(e.g / e.s * 100).toFixed(1) : 0,
      yoyPct: e.ps ? +((e.s - e.ps) / e.ps * 100).toFixed(1) : 0,
      subCount: e.subs.filter((x) => x.s > 0).length,
      dppSales,
      prevDppSales,
      dppSalesGrowthPct: prevDppSales ? +((dppSales - prevDppSales) / prevDppSales * 100).toFixed(1) : 0,
      closed: e.s === 0 && e.ps > 0,
      bySub: e.subs,
    };
  }).sort((a, b) => b.s - a.s);
}

/**
 * 스코프 요약. 일평당 = Σ매출 / Σ(평·일) — dppSales=매출/평일 이므로 평일=매출/dpp 로 역산 합산.
 * 전기 평·일은 전기 dppSales로 따로 역산(면적 변동 반영).
 */
export function buildScopeSummary(catRows: OffRank[]): ScopeSummary {
  const s = catRows.reduce((t, r) => t + r.s, 0);
  const ps = catRows.reduce((t, r) => t + r.ps, 0);
  const g = catRows.reduce((t, r) => t + r.g, 0);
  let areaDays = 0;
  let prevAreaDays = 0;
  for (const r of catRows) {
    if (r.dppSales) areaDays += r.s / r.dppSales;
    if (r.prevDppSales) prevAreaDays += r.ps / r.prevDppSales;
  }
  const dppSales = areaDays ? Math.round(s / areaDays) : 0;
  const prevDppSales = prevAreaDays ? Math.round(ps / prevAreaDays) : 0;
  return {
    s, ps, g, gpm: s ? +(g / s * 100).toFixed(1) : 0,
    yoyPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0,
    brands: catRows.filter((r) => !r.closed).length,
    closedCount: catRows.filter((r) => r.closed).length,
    dppSales,
    prevDppSales,
    dppSalesGrowthPct: prevDppSales ? +((dppSales - prevDppSales) / prevDppSales * 100).toFixed(1) : 0,
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 화면에 이미 로드된 형제 목록에서 코호트 통계 계산 (새 쿼리 0). 영업 중 3개 이상이라야 의미. */
export function buildCohort(list: OffRank[], label: string): CohortStat | null {
  const valid = list.filter((r) => !r.closed && r.s > 0);
  if (valid.length < 3) return null;
  return {
    label,
    n: valid.length,
    medianYoy: median(valid.filter((r) => r.ps > 0).map((r) => r.yoyPct)),
    medianGpm: median(valid.map((r) => r.gpm)),
    totalS: valid.reduce((t, r) => t + r.s, 0),
    totalPs: valid.reduce((t, r) => t + r.ps, 0),
  };
}
