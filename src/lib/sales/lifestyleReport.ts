import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { isOthersBrand } from "./labels";
import { decomposeSymmetric } from "./decompose";

// 라이프스타일 부문 실적 리포트 — "면적 늘어서 오른 것 아니냐" 도전에 답하기 위한 성장 분해.
//
// 핵심: 당기 매출 증가분(ΔS)을 대칭(Shapley) 분해로 '면적 효과'와 '좌판효율 효과'로 가른다.
//   기준연도 선택에 따라 결과가 달라지지 않아(대칭) 방어에 유리.
//   신규 출점 지점은 분해 불가(전년 없음) → 전액 '신규 기여'로, 기존점만 면적/효율로 분해.
//
// 라이프스타일 = division "기타"(displayDivision: 기타→라이프스타일). '그외' 브랜드(엠페스트 등)는 제외.
//
// 단위: sales_offline_month.area_raw 는 ERP가 '평'으로 내려준 값(정수). days 는 파일 "N일누적" 파싱값.
//   일평당매출 = 매출 / (면적 × N). 당기·전기 모두 같은 N(당월 파일 기준)으로 비교 → 부분월도 공정.

const LIFESTYLE_DIVISION = "기타";

function daysInMonth(ym: string): number {
  const d = ym.replace(/[^0-9]/g, "");
  const y = Number(d.slice(0, 4)), m = Number(d.slice(4, 6));
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
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
}

export interface LifestyleReport {
  curLabel: string; prevLabel: string; days: number;
  totals: {
    salesCur: number; salesPrev: number; salesDelta: number; salesGrowthPct: number;
    areaCur: number; areaPrev: number; areaDelta: number; areaGrowthPct: number;
    dppCur: number; dppPrev: number; dppGrowthPct: number;
    storeCur: number; storePrev: number;
  };
  decomposition: {
    newStore: number;       // 신규 출점 기여 (원, ≥0)
    closedStore: number;    // 퇴점 손실 (원, ≤0)
    existingArea: number;   // 기존점 면적 효과 (원)
    existingEff: number;    // 기존점 좌판효율 효과 (원)  ← 도전에 대한 반박 핵심
    total: number;          // = salesDelta (합 검증)
    existingSalesGrowthPct: number;  // 기존점만 매출 성장률
    existingDppGrowthPct: number;    // 기존점만 일평당 성장률
    existingCount: number;
  };
  stores: LifestyleStoreLine[];
}

interface Raw { brand: string; store: string; sales: number; area: number; days: number | null; p: string }

async function fetchLifestyle(cur: string, prev: string): Promise<Raw[]> {
  const sb = createServiceClient();
  const out: Raw[] = [];
  let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb
      .from("sales_offline_month")
      .select("brand,store,sales,area_raw,days,ym")
      .eq("division", LIFESTYLE_DIVISION)
      .in("ym", [cur, prev])
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`lifestyleReport: ${error.message}`);
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of batch) {
      out.push({
        brand: String(r.brand ?? ""), store: String(r.store ?? ""),
        sales: Number(r.sales) || 0, area: Number(r.area_raw) || 0,
        days: r.days == null ? null : Number(r.days), p: String(r.ym ?? ""),
      });
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/** 오프라인 당월 라이프스타일 리포트. 데이터 없으면 null. */
export async function getLifestyleMonthReport(): Promise<LifestyleReport | null> {
  const sb = createServiceClient();
  const { data: latest } = await sb
    .from("sales_offline_month").select("ym").order("ym", { ascending: false }).limit(1).maybeSingle();
  const cur = (latest?.ym as string | undefined) ?? null;
  if (!cur) return null;
  const prev = `${Number(cur.slice(0, 4)) - 1}${cur.slice(4)}`;

  const rows = (await fetchLifestyle(cur, prev)).filter((r) => !isOthersBrand(r.brand));
  if (rows.length === 0) return null;

  // 동일 일수 N — 당월 파일 days, 없으면 캘린더 말일. 당기·전기 공통 적용.
  const N = rows.find((r) => r.p === cur && r.days != null)?.days ?? daysInMonth(cur);

  type Agg = { s1: number; s0: number; a1: number; a0: number };
  const byStore = new Map<string, Agg>();
  for (const r of rows) {
    const e = byStore.get(r.store) ?? { s1: 0, s0: 0, a1: 0, a0: 0 };
    if (r.p === cur) { e.s1 += r.sales; e.a1 += r.area; }
    else if (r.p === prev) { e.s0 += r.sales; e.a0 += r.area; }
    byStore.set(r.store, e);
  }

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
      kind = "new"; newStore += s1;              // 전년 없음/면적 없음 → 전액 신규 기여
    } else {
      continue; // 당기·전기 모두 실적 없음
    }

    const dppCur = a1 > 0 ? s1 / (a1 * N) : 0;
    const dppPrev = a0 > 0 ? s0 / (a0 * N) : 0;
    stores.push({
      store, kind,
      areaCur: round1(a1), areaPrev: round1(a0), areaDelta: round1(a1 - a0),
      dppCur: Math.round(dppCur), dppPrev: Math.round(dppPrev), dppGrowthPct: pct1(dppCur - dppPrev, dppPrev),
      salesCur: s1, salesPrev: s0, salesDelta: s1 - s0, salesGrowthPct: pct1(s1 - s0, s0),
      areaEffect: Math.round(areaEffect), effEffect: Math.round(effEffect),
    });
  }
  stores.sort((a, b) => b.salesCur - a.salesCur);

  const salesCur = stores.reduce((t, s) => t + s.salesCur, 0);
  const salesPrev = stores.reduce((t, s) => t + s.salesPrev, 0);
  const areaCur = stores.reduce((t, s) => t + s.areaCur, 0);
  const areaPrev = stores.reduce((t, s) => t + s.areaPrev, 0);
  const dppCur = areaCur > 0 ? salesCur / (areaCur * N) : 0;
  const dppPrev = areaPrev > 0 ? salesPrev / (areaPrev * N) : 0;
  const exDppCur = exA1 > 0 ? exS1 / (exA1 * N) : 0;
  const exDppPrev = exA0 > 0 ? exS0 / (exA0 * N) : 0;

  return {
    curLabel: cur, prevLabel: prev, days: N,
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
