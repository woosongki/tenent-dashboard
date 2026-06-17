import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SalesStoreMeta, AggRow, GroupSummary, Grade } from "./types";

// ── 기간 유틸 ──
function prevYearYm(ym: string): string {
  const [y, m] = ym.split("-");
  return `${Number(y) - 1}-${m}`;
}
/** [start,end] 월 범위 → 'YYYY-MM' 배열 (inclusive) */
export function ymRange(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

const DAYS_PER_MONTH = 30;
interface MonthlyAgg { sales: number; gp: number; }

// 키: division|cat|brand|store
function rowKey(d: string, c: string, b: string, s: string) {
  return `${d}|${c}|${b}|${s}`;
}

/** 기간 매출/이익을 (division|cat|brand|store) 키로 합산 */
async function sumByStore(divisions: string[] | null, yms: string[]) {
  const supabase = await createClient();
  const map = new Map<string, MonthlyAgg>();
  let q = supabase
    .from("sales_monthly")
    .select("division,cat,brand,store,sales,gp,ym")
    .in("ym", yms);
  if (divisions) q = q.in("division", divisions);
  const { data, error } = await q;
  if (error) throw new Error(`sales_monthly: ${error.message}`);
  for (const r of data ?? []) {
    const k = rowKey(r.division, r.cat, r.brand, r.store);
    const cur = map.get(k) ?? { sales: 0, gp: 0 };
    cur.sales += Number(r.sales); cur.gp += Number(r.gp);
    map.set(k, cur);
  }
  return map;
}

async function getMetaMap(): Promise<Map<string, SalesStoreMeta>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_store_meta")
    .select("division,cat,brand,store,area,grade,bcat");
  if (error) throw new Error(`sales_store_meta: ${error.message}`);
  const map = new Map<string, SalesStoreMeta>();
  for (const r of data ?? []) {
    map.set(rowKey(r.division, r.cat, r.brand, r.store), {
      division: r.division, cat: r.cat, brand: r.brand, store: r.store,
      area: Number(r.area), grade: (r.grade ?? "") as Grade, bcat: r.bcat ?? "",
    });
  }
  return map;
}

/**
 * 기간 집계 → AggRow[] (당기 vs 전년동기, 평당지표 포함)
 * @param divisions null이면 전 부문
 */
export async function getAggRows(
  start: string, end: string, divisions: string[] | null = null,
): Promise<AggRow[]> {
  const curYms = ymRange(start, end);
  const prevYms = curYms.map(prevYearYm);
  const days = curYms.length * DAYS_PER_MONTH;

  const [cur, prev, meta] = await Promise.all([
    sumByStore(divisions, curYms),
    sumByStore(divisions, prevYms),
    getMetaMap(),
  ]);

  const rows: AggRow[] = [];
  for (const [k, c] of cur) {
    const [division, cat, brand, store] = k.split("|");
    const p = prev.get(k) ?? { sales: 0, gp: 0 };
    const m = meta.get(k);
    const area = m?.area ?? 0;
    const dayArea = area * days;
    rows.push({
      division, cat, brand, store,
      s: c.sales, ps: p.sales, g: c.gp, pg: p.gp,
      gpm: c.sales ? +(c.gp / c.sales * 100).toFixed(1) : 0,
      area,
      spd:  dayArea ? Math.round(c.sales / dayArea) : 0,
      pspd: dayArea ? Math.round(p.sales / dayArea) : 0,
      gpd:  dayArea ? Math.round(c.gp / dayArea) : 0,
      pgpd: dayArea ? Math.round(p.gp / dayArea) : 0,
      grade: m?.grade ?? "", bcat: m?.bcat ?? "",
      yoyPct: p.sales ? +((c.sales - p.sales) / p.sales * 100).toFixed(1) : 0,
    });
  }
  return rows.sort((a, b) => b.s - a.s);
}

/** AggRow[] → 임의 키(division|cat)별 요약 그룹 */
export function summarizeBy(
  rows: AggRow[], keyOf: (r: AggRow) => string,
): GroupSummary[] {
  const groups = new Map<string, AggRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out: GroupSummary[] = [];
  for (const [key, rs] of groups) {
    const s = rs.reduce((t, r) => t + r.s, 0);
    const g = rs.reduce((t, r) => t + r.g, 0);
    const area = rs.reduce((t, r) => t + r.area, 0);
    out.push({
      key, s, g,
      gpm: s ? +(g / s * 100).toFixed(1) : 0,
      area,
      spd: area ? Math.round(s / area / DAYS_PER_MONTH) : 0,
      gpd: area ? Math.round(g / area / DAYS_PER_MONTH) : 0,
      stores: rs.length,
    });
  }
  return out.sort((a, b) => b.s - a.s);
}

// ── 온라인(당월) 집계 ──
export interface OnlineRank {
  key: string;        // 브랜드명 또는 지점명
  cat?: string;       // 브랜드 랭킹일 때 복종
  s: number;          // 당월 매출
  ps: number;         // 전년동월 매출
  yoyPct: number;
  byChannel: { channel: string; s: number }[];  // 채널별 (당월)
  bySub?: { key: string; s: number }[];          // 하위 분해 (브랜드→지점 등)
}

interface OnlineRow { cat: string; brand: string; store: string; channel: string; ym: string; sales: number; }

async function fetchOnline(yms: string[]): Promise<OnlineRow[]> {
  const supabase = await createClient();
  // 페이지네이션 (Supabase 기본 1000행 제한 회피)
  const all: OnlineRow[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("sales_online_monthly")
      .select("cat,brand,store,channel,ym,sales")
      .in("ym", yms)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`sales_online_monthly: ${error.message}`);
    all.push(...(data ?? []) as OnlineRow[]);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * 온라인 당월 집계 — 브랜드 랭킹 + 지점 랭킹 (전년동월비 포함)
 * @param ym 당월 'YYYY-MM'  @param prevYm 전년동월 'YYYY-MM'
 */
export async function getOnlineMonth(ym: string, prevYm: string) {
  const rows = await fetchOnline([ym, prevYm]);

  function rank(
    keyOf: (r: OnlineRow) => string, withCat: boolean,
    subOf?: (r: OnlineRow) => string,
  ): OnlineRank[] {
    const cur = new Map<string, { s: number; cat: string; ch: Map<string, number>; sub: Map<string, number> }>();
    const prev = new Map<string, number>();
    for (const r of rows) {
      const k = keyOf(r);
      if (r.ym === ym) {
        const e = cur.get(k) ?? { s: 0, cat: r.cat, ch: new Map(), sub: new Map() };
        e.s += r.sales;
        e.ch.set(r.channel, (e.ch.get(r.channel) ?? 0) + r.sales);
        if (subOf) { const sk = subOf(r); e.sub.set(sk, (e.sub.get(sk) ?? 0) + r.sales); }
        cur.set(k, e);
      } else {
        prev.set(k, (prev.get(k) ?? 0) + r.sales);
      }
    }
    const out: OnlineRank[] = [];
    for (const [k, e] of cur) {
      const ps = prev.get(k) ?? 0;
      out.push({
        key: k,
        cat: withCat ? e.cat : undefined,
        s: e.s, ps,
        yoyPct: ps ? +((e.s - ps) / ps * 100).toFixed(1) : 0,
        byChannel: [...e.ch.entries()].map(([channel, s]) => ({ channel, s })).sort((a, b) => b.s - a.s),
        bySub: subOf ? [...e.sub.entries()].map(([key, s]) => ({ key, s })).sort((a, b) => b.s - a.s) : undefined,
      });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  // 채널 전체 합계 (당월/전년)
  const chTotals = new Map<string, { s: number; ps: number }>();
  for (const r of rows) {
    const e = chTotals.get(r.channel) ?? { s: 0, ps: 0 };
    if (r.ym === ym) e.s += r.sales; else e.ps += r.sales;
    chTotals.set(r.channel, e);
  }

  const total = rows.filter((r) => r.ym === ym).reduce((t, r) => t + r.sales, 0);
  const prevTotal = rows.filter((r) => r.ym === prevYm).reduce((t, r) => t + r.sales, 0);

  return {
    ym, prevYm, total, prevTotal,
    yoyPct: prevTotal ? +((total - prevTotal) / prevTotal * 100).toFixed(1) : 0,
    brands: rank((r) => r.brand, true, (r) => r.store),   // 브랜드 → 지점 분해
    stores: rank((r) => r.store, false, (r) => r.brand),  // 지점 → 브랜드 분해
    channels: [...chTotals.entries()]
      .map(([channel, v]) => ({ channel, ...v, yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.s - a.s),
  };
}

/** 온라인 가용 월 목록 (최신순) — order로 확정 선택, 1000행 제한 영향 없음 */
export async function getOnlineMeta() {
  const supabase = await createClient();
  // 최신 월
  const { data: latest } = await supabase
    .from("sales_online_monthly").select("ym").order("ym", { ascending: false }).limit(1);
  // 가장 오래된 월
  const { data: earliest } = await supabase
    .from("sales_online_monthly").select("ym").order("ym", { ascending: true }).limit(1);
  const max = latest?.[0]?.ym ?? null;
  const min = earliest?.[0]?.ym ?? null;
  // 구간 내 distinct는 별도 필요 없음 — 현재 UI는 최신월만 사용
  const yms = max ? (min && min !== max ? [max, min] : [max]) : [];
  return { yms, hasData: !!max };
}

// ── 온라인 누적 (연 단위, 8번 탭) ──
interface OnlineCumRow { cat: string; brand: string; store: string; channel: string; year: string; sales: number; }

async function fetchOnlineCum(years: string[]): Promise<OnlineCumRow[]> {
  const supabase = await createClient();
  const all: OnlineCumRow[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("sales_online_cum")
      .select("cat,brand,store,channel,year,sales")
      .in("year", years)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`sales_online_cum: ${error.message}`);
    all.push(...(data ?? []) as OnlineCumRow[]);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// 누적에서 제외할 채널 (운영 종료/미사용 — 데이터가 들어와도 무시)
const EXCLUDED_CUM_CHANNELS = new Set(["옥션", "G마켓"]);

/**
 * 온라인 누적 집계 — 브랜드/지점 랭킹 (전년 누적비)
 * @param year '2026'  @param prevYear '2025'
 */
export async function getOnlineCumulative(year: string, prevYear: string) {
  const rows = (await fetchOnlineCum([year, prevYear]))
    .filter((r) => !EXCLUDED_CUM_CHANNELS.has(r.channel));

  function rank(
    keyOf: (r: OnlineCumRow) => string, withCat: boolean,
    subOf?: (r: OnlineCumRow) => string,
  ): OnlineRank[] {
    const cur = new Map<string, { s: number; cat: string; ch: Map<string, number>; sub: Map<string, number> }>();
    const prev = new Map<string, number>();
    for (const r of rows) {
      const k = keyOf(r);
      if (r.year === year) {
        const e = cur.get(k) ?? { s: 0, cat: r.cat, ch: new Map(), sub: new Map() };
        e.s += r.sales;
        e.ch.set(r.channel, (e.ch.get(r.channel) ?? 0) + r.sales);
        if (subOf) { const sk = subOf(r); e.sub.set(sk, (e.sub.get(sk) ?? 0) + r.sales); }
        cur.set(k, e);
      } else {
        prev.set(k, (prev.get(k) ?? 0) + r.sales);
      }
    }
    const out: OnlineRank[] = [];
    for (const [k, e] of cur) {
      const ps = prev.get(k) ?? 0;
      out.push({
        key: k, cat: withCat ? e.cat : undefined,
        s: e.s, ps, yoyPct: ps ? +((e.s - ps) / ps * 100).toFixed(1) : 0,
        byChannel: [...e.ch.entries()].map(([channel, s]) => ({ channel, s })).sort((a, b) => b.s - a.s),
        bySub: subOf ? [...e.sub.entries()].map(([key, s]) => ({ key, s })).sort((a, b) => b.s - a.s) : undefined,
      });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  const chTotals = new Map<string, { s: number; ps: number }>();
  for (const r of rows) {
    const e = chTotals.get(r.channel) ?? { s: 0, ps: 0 };
    if (r.year === year) e.s += r.sales; else e.ps += r.sales;
    chTotals.set(r.channel, e);
  }
  const total = rows.filter((r) => r.year === year).reduce((t, r) => t + r.sales, 0);
  const prevTotal = rows.filter((r) => r.year === prevYear).reduce((t, r) => t + r.sales, 0);

  return {
    year, prevYear, total, prevTotal,
    yoyPct: prevTotal ? +((total - prevTotal) / prevTotal * 100).toFixed(1) : 0,
    brands: rank((r) => r.brand, true, (r) => r.store),
    stores: rank((r) => r.store, false, (r) => r.brand),
    channels: [...chTotals.entries()]
      .map(([channel, v]) => ({ channel, ...v, yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.s - a.s),
  };
}

/** 온라인 누적 가용 연도 (최신순) — order로 확정 선택 */
export async function getOnlineCumMeta() {
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("sales_online_cum").select("year").order("year", { ascending: false }).limit(1);
  const { data: earliest } = await supabase
    .from("sales_online_cum").select("year").order("year", { ascending: true }).limit(1);
  const max = latest?.[0]?.year ?? null;
  const min = earliest?.[0]?.year ?? null;
  const years = max ? (min && min !== max ? [max, min] : [max]) : [];
  return { years, hasData: !!max };
}

/** 데이터 존재 여부 + 가용 기간 + 부문 목록 (UI 초기화용) */
export async function getSalesMeta() {
  const supabase = await createClient();
  const [{ data: first }, { data: last }, { data: divs }] = await Promise.all([
    supabase.from("sales_monthly").select("ym").order("ym", { ascending: true }).limit(1),
    supabase.from("sales_monthly").select("ym").order("ym", { ascending: false }).limit(1),
    supabase.from("sales_monthly").select("division"),
  ]);
  const divisions = [...new Set((divs ?? []).map((d) => d.division))];
  return {
    hasData: (first?.length ?? 0) > 0,
    minYm: first?.[0]?.ym ?? null,
    maxYm: last?.[0]?.ym ?? null,
    divisions,
  };
}
