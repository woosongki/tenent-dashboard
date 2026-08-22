import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { isOthersBrand } from "./labels";
import { decomposeSymmetric } from "./decompose";
import { computeDecomposition, type Decomposition } from "./diagnose";
import type { OffRank, OffSub } from "./queries";

// 라이프스타일 부문 실적 리포트 — "면적 늘어서 오른 것 아니냐" 도전에 답하기 위한 성장 분해.
//
// 당월(sales_offline_month) / 누적(sales_offline_cum) 두 모드 공용.
//   · 당월: 저장 area_raw = 평. 조회 시 N(파일 "N일누적", 없으면 말일)로 일평당 정규화.
//   · 누적: 저장 area_raw = 평·일(ERP가 연초~기준월 경과일 반영). 면적(평) = area_raw ÷ cumDays.
//   두 모드 모두 내부적으로 면적(평)으로 통일하고, 일평당매출 = 매출 ÷ (면적 × 기간일수).
//
// 성장 분해: 당기 매출 증감(ΔS)을 대칭(Shapley) 분해로 면적효과/좌판효율효과로 가른다.
//   신규 출점은 전년 없음 → 전액 신규 기여. (UI에서 면적효과=평수증가는 신규출점으로 합산 표기)
//
// 라이프스타일 = division "기타"(displayDivision: 기타→라이프스타일). '그외' 브랜드는 제외.

export type LifestyleScope = "month" | "cum";
const LIFESTYLE_DIVISION = "기타";

function daysInMonth(ym: string): number {
  const d = ym.replace(/[^0-9]/g, "");
  const y = Number(d.slice(0, 4)), m = Number(d.slice(4, 6));
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}
/** 해당 연도 1/1 ~ 기준월 말일 경과일수 (queries.cumDays 동일 규칙). */
function cumDaysOf(year: string, throughYm: string | null): number {
  const y = Number(year);
  if (!throughYm || Number.isNaN(y)) return 181;
  const m = Number(throughYm.replace(/[^0-9]/g, "").slice(4, 6));
  if (!m) return 181;
  const end = new Date(y, m, 0), start = new Date(y, 0, 1);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct1 = (num: number, den: number) => (den ? +(((num) / den) * 100).toFixed(1) : 0);

export type StoreKind = "existing" | "new" | "closed";

export interface LifestyleStoreLine {
  store: string;
  kind: StoreKind;
  areaCur: number; areaPrev: number; areaDelta: number;       // 평
  dppCur: number; dppPrev: number; dppGrowthPct: number;      // 일평당매출(원/평·일)
  salesCur: number; salesPrev: number; salesDelta: number;    // 원
  salesGrowthPct: number;
  areaEffect: number;   // 원 — 기존점 매출증감 중 면적 기여 (신규/퇴점=0)
  effEffect: number;    // 원 — 기존점 매출증감 중 좌판효율 기여
  /** 지점 내 브랜드 단위 매출증감분해 (신규/평수증가/기존/퇴점 + TOP5). 비교 대상 없으면 undefined. */
  decomposition?: Decomposition;
}

export interface LifestyleReport {
  scope: LifestyleScope;
  curLabel: string; prevLabel: string; days: number; dayNoun: string; // '영업일' | '누적일'
  totals: {
    salesCur: number; salesPrev: number; salesDelta: number; salesGrowthPct: number;
    areaCur: number; areaPrev: number; areaDelta: number; areaGrowthPct: number;
    dppCur: number; dppPrev: number; dppGrowthPct: number;
    storeCur: number; storePrev: number;
  };
  decomposition: {
    newStore: number; closedStore: number; existingArea: number; existingEff: number;
    total: number;
    existingSalesGrowthPct: number; existingDppGrowthPct: number; existingCount: number;
  };
  stores: LifestyleStoreLine[];
}

// 정규화 행: 면적은 평(area). p = 기간 키.
interface NRow { brand: string; store: string; sales: number; area: number; p: string }
interface Loaded {
  scope: LifestyleScope;
  cur: string; prev: string; rows: NRow[];
  daysCur: number; daysPrev: number;
  curLabel: string; prevLabel: string; days: number; dayNoun: string;
}

async function fetchRaw(table: string, col: string, periods: string[], withDays: boolean) {
  const sb = createServiceClient();
  const cols = withDays ? `brand,store,sales,area_raw,days,${col}` : `brand,store,sales,area_raw,${col}`;
  const out: { brand: string; store: string; sales: number; area: number; days: number | null; p: string }[] = [];
  let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb.from(table).select(cols)
      .eq("division", LIFESTYLE_DIVISION).in(col, periods)
      .order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`lifestyleReport(${table}): ${error.message}`);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of batch) out.push({
      brand: String(r.brand ?? ""), store: String(r.store ?? ""),
      sales: Number(r.sales) || 0, area: Number(r.area_raw) || 0,
      days: r.days == null ? null : Number(r.days), p: String(r[col] ?? ""),
    });
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function loadMonth(): Promise<Loaded | null> {
  const sb = createServiceClient();
  const { data: latest } = await sb.from("sales_offline_month").select("ym").order("ym", { ascending: false }).limit(1).maybeSingle();
  const cur = (latest?.ym as string | undefined) ?? null;
  if (!cur) return null;
  const prev = `${Number(cur.slice(0, 4)) - 1}${cur.slice(4)}`;
  const raw = (await fetchRaw("sales_offline_month", "ym", [cur, prev], true)).filter((r) => !isOthersBrand(r.brand));
  if (raw.length === 0) return null;
  // 동일 일수 N — 당월 파일 days, 없으면 캘린더 말일. 당기·전기 공통.
  const N = raw.find((r) => r.p === cur && r.days != null)?.days ?? daysInMonth(cur);
  const rows: NRow[] = raw.map((r) => ({ brand: r.brand, store: r.store, sales: r.sales, area: r.area, p: r.p })); // area_raw=평
  return { scope: "month", cur, prev, rows, daysCur: N, daysPrev: N, curLabel: cur, prevLabel: prev, days: N, dayNoun: "영업일" };
}

async function loadCum(): Promise<Loaded | null> {
  const sb = createServiceClient();
  const { data } = await sb.from("sales_offline_cum").select("year, through_ym").order("year", { ascending: false }).limit(1);
  const cur = (data?.[0]?.year as string | undefined) ?? null;
  if (!cur) return null;
  const through = (data?.[0]?.through_ym as string | null | undefined) ?? null;
  const prev = String(Number(cur) - 1);
  const prevThrough = through ? `${prev}-${through.slice(5, 7)}` : null;
  const dc = cumDaysOf(cur, through), dp = cumDaysOf(prev, prevThrough);
  const raw = (await fetchRaw("sales_offline_cum", "year", [cur, prev], false)).filter((r) => !isOthersBrand(r.brand));
  if (raw.length === 0) return null;
  // area_raw = 평·일 → 면적(평) = area_raw ÷ 기간 누적일수(cur/prev 각각).
  const rows: NRow[] = raw.map((r) => ({
    brand: r.brand, store: r.store, sales: r.sales, p: r.p,
    area: r.area / (r.p === cur ? dc : dp),
  }));
  return { scope: "cum", cur, prev, rows, daysCur: dc, daysPrev: dp, curLabel: `${cur} 누적`, prevLabel: `${prev} 누적`, days: dc, dayNoun: "누적일" };
}

/** 라이프스타일 리포트 (당월 또는 누적). 데이터 없으면 null. */
export async function getLifestyleReport(scope: LifestyleScope): Promise<LifestyleReport | null> {
  const L = scope === "month" ? await loadMonth() : await loadCum();
  if (!L) return null;
  const { rows, cur, prev, daysCur: dc, daysPrev: dp } = L;

  type Agg = { s1: number; s0: number; a1: number; a0: number };
  const byStore = new Map<string, Agg>();
  const byStoreBrand = new Map<string, Map<string, Agg>>();
  for (const r of rows) {
    const e = byStore.get(r.store) ?? { s1: 0, s0: 0, a1: 0, a0: 0 };
    if (r.p === cur) { e.s1 += r.sales; e.a1 += r.area; }
    else if (r.p === prev) { e.s0 += r.sales; e.a0 += r.area; }
    byStore.set(r.store, e);

    let bm = byStoreBrand.get(r.store);
    if (!bm) { bm = new Map(); byStoreBrand.set(r.store, bm); }
    const be = bm.get(r.brand) ?? { s1: 0, s0: 0, a1: 0, a0: 0 };
    if (r.p === cur) { be.s1 += r.sales; be.a1 += r.area; }
    else if (r.p === prev) { be.s0 += r.sales; be.a0 += r.area; }
    bm.set(r.brand, be);
  }

  const dppOf = (s: number, a: number, days: number) => (a > 0 ? s / (a * days) : 0);

  const stores: LifestyleStoreLine[] = [];
  let newStore = 0, closedStore = 0, existingArea = 0, existingEff = 0;
  let exS1 = 0, exS0 = 0, exA1 = 0, exA0 = 0, existingCount = 0;

  for (const [store, e] of byStore) {
    const { s1, s0, a1, a0 } = e;
    let kind: StoreKind = "existing";
    let areaEffect = 0, effEffect = 0;

    if (s1 <= 0 && s0 > 0) {
      kind = "closed"; closedStore += -s0;
    } else if (s1 > 0 && a1 > 0 && a0 > 0 && s0 > 0) {
      kind = "existing";
      ({ areaEffect, effEffect } = decomposeSymmetric(s1, s0, a1, a0));  // 합 = s1 − s0
      existingArea += areaEffect; existingEff += effEffect;
      exS1 += s1; exS0 += s0; exA1 += a1; exA0 += a0; existingCount++;
    } else if (s1 > 0) {
      kind = "new"; newStore += s1;
    } else {
      continue;
    }

    const dppCur = dppOf(s1, a1, dc);
    const dppPrev = dppOf(s0, a0, dp);

    // 브랜드 단위 매출증감분해 — 지점 행 펼침 시 워터폴/TOP5 렌더 입력.
    const brandMap = byStoreBrand.get(store);
    let decomposition: Decomposition | undefined;
    if (brandMap && brandMap.size > 0) {
      const bySub: OffSub[] = [];
      for (const [brand, ba] of brandMap) {
        const bDppCur = Math.round(dppOf(ba.s1, ba.a1, dc));
        const bDppPrev = Math.round(dppOf(ba.s0, ba.a0, dp));
        bySub.push({
          key: brand, s: ba.s1, ps: ba.s0, g: 0, pg: 0,
          growthS: ba.s1 - ba.s0, growthPct: pct1(ba.s1 - ba.s0, ba.s0),
          growthG: 0, growthGPct: 0,
          area: round1(ba.a1), prevArea: round1(ba.a0),
          dppSales: bDppCur, prevDppSales: bDppPrev, dppSalesGrowthPct: pct1(bDppCur - bDppPrev, bDppPrev),
          storeCnt: 1, closed: ba.s1 <= 0 && ba.s0 > 0,
        });
      }
      bySub.sort((a, b) => b.s - a.s);
      const offRank: OffRank = {
        key: store, s: s1, ps: s0, g: 0, pg: 0, gpm: 0, yoyPct: pct1(s1 - s0, s0),
        subCount: bySub.filter((x) => x.s > 0).length,
        dppSales: Math.round(dppCur), prevDppSales: Math.round(dppPrev), dppSalesGrowthPct: pct1(dppCur - dppPrev, dppPrev),
        closed: kind === "closed", bySub,
      };
      decomposition = computeDecomposition(offRank);
    }

    stores.push({
      store, kind,
      areaCur: round1(a1), areaPrev: round1(a0), areaDelta: round1(a1 - a0),
      dppCur: Math.round(dppCur), dppPrev: Math.round(dppPrev), dppGrowthPct: pct1(dppCur - dppPrev, dppPrev),
      salesCur: s1, salesPrev: s0, salesDelta: s1 - s0, salesGrowthPct: pct1(s1 - s0, s0),
      areaEffect: Math.round(areaEffect), effEffect: Math.round(effEffect),
      decomposition,
    });
  }
  stores.sort((a, b) => b.salesCur - a.salesCur);

  const salesCur = stores.reduce((t, s) => t + s.salesCur, 0);
  const salesPrev = stores.reduce((t, s) => t + s.salesPrev, 0);
  const areaCur = stores.reduce((t, s) => t + s.areaCur, 0);
  const areaPrev = stores.reduce((t, s) => t + s.areaPrev, 0);
  const dppCur = dppOf(salesCur, areaCur, dc);
  const dppPrev = dppOf(salesPrev, areaPrev, dp);
  const exDppCur = dppOf(exS1, exA1, dc);
  const exDppPrev = dppOf(exS0, exA0, dp);

  return {
    scope, curLabel: L.curLabel, prevLabel: L.prevLabel, days: L.days, dayNoun: L.dayNoun,
    totals: {
      salesCur, salesPrev, salesDelta: salesCur - salesPrev, salesGrowthPct: pct1(salesCur - salesPrev, salesPrev),
      areaCur: round1(areaCur), areaPrev: round1(areaPrev), areaDelta: round1(areaCur - areaPrev), areaGrowthPct: pct1(areaCur - areaPrev, areaPrev),
      dppCur: Math.round(dppCur), dppPrev: Math.round(dppPrev), dppGrowthPct: pct1(dppCur - dppPrev, dppPrev),
      storeCur: stores.filter((s) => s.kind !== "closed").length,
      storePrev: stores.filter((s) => s.salesPrev > 0).length,
    },
    decomposition: {
      newStore: Math.round(newStore), closedStore: Math.round(closedStore),
      existingArea: Math.round(existingArea), existingEff: Math.round(existingEff),
      total: salesCur - salesPrev,
      existingSalesGrowthPct: pct1(exS1 - exS0, exS0),
      existingDppGrowthPct: pct1(exDppCur - exDppPrev, exDppPrev),
      existingCount,
    },
    stores,
  };
}
