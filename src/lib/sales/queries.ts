import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isOthersBrand } from "./labels";
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

/** 'YYYY-MM' 의 실제 말일 (28~31). Feb 윤년 처리 포함. */
function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return DAYS_PER_MONTH;
  return new Date(y, m, 0).getDate();   // 다음달 0일 = 이번달 말일
}
interface MonthlyAgg { sales: number; gp: number; }

// 키: division|cat|brand|store
function rowKey(d: string, c: string, b: string, s: string) {
  return `${d}|${c}|${b}|${s}`;
}

/** 기간 매출/이익을 (division|cat|brand|store) 키로 합산 */
async function sumByStore(divisions: string[] | null, yms: string[]) {
  const supabase = createServiceClient();
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
  const supabase = createServiceClient();
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
  closed?: boolean;   // 퇴점: 전년 실적만 있고 올해 매출 없음
  byChannel: { channel: string; s: number }[];  // 채널별 (당월)
  bySub?: { key: string; s: number; closed?: boolean }[];   // 하위 분해 (브랜드→지점 등), closed=하위 단위 퇴점
}

/** 하위(지점/브랜드) 분해 — 올해 매출 + 전년에만 있던 항목(퇴점) 합쳐 정렬 */
function buildSub(curSub: Map<string, number>, prevSub?: Map<string, number>): { key: string; s: number; closed?: boolean }[] {
  const keys = new Set<string>([...curSub.keys(), ...(prevSub?.keys() ?? [])]);
  return [...keys].map((key) => {
    const s = curSub.get(key) ?? 0;
    const ps = prevSub?.get(key) ?? 0;
    return s === 0 && ps > 0 ? { key, s, closed: true } : { key, s };
  }).sort((a, b) => b.s - a.s);
}

interface OnlineRow { cat: string; brand: string; store: string; channel: string; ym: string; sales: number; }

// 26년 6월 ERP 익스포트부터 등장한 세분화 분류를 누적탭 기존 프레임으로 흡수.
// Why: 누적(8번) 파일은 아직 옛 분류를 쓰는 상태에서, 당월(9번)만 새 분류가 들어오면
// 두 탭의 채널/복종 행 구성이 달라져 사용자 혼란. 데이터는 보존하고 표시만 통합.
// How to apply: fetchOnline/fetchOnlineCum 응답 행에 일괄 적용.
const ONLINE_CHANNEL_ALIAS: Record<string, string> = {
  "패션플러스(중간정산)": "패션플러스",
};
const ONLINE_CAT_ALIAS: Record<string, string> = {
  "아동특(온)": "아동의류(특정매입)",
  "스포츠특(온)": "스포츠(특정)NC",
  "잡화특(온)": "잡화(특정매입)",
  "캐주얼특(온)": "캐쥬얼(특정매입)",
  "숙녀특(온)": "여성의류(특정)NC",
  "영캐특(온)": "영캐쥬얼(특정)2001",
  "신사특(온)": "남성의류(특정매입)",
};
function normalizeOnline<R extends { cat: string; channel: string }>(r: R): R {
  return {
    ...r,
    cat: ONLINE_CAT_ALIAS[r.cat] ?? r.cat,
    channel: ONLINE_CHANNEL_ALIAS[r.channel] ?? r.channel,
  };
}

async function fetchOnline(yms: string[]): Promise<OnlineRow[]> {
  const supabase = createServiceClient();
  // 페이지네이션 (Supabase 기본 1000행 제한 회피)
  const all: OnlineRow[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("sales_online_monthly")
      .select("cat,brand,store,channel,ym,sales")
      .in("ym", yms)
      .order("id", { ascending: true })   // 안정 정렬 — range 페이징 누락/중복 방지
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`sales_online_monthly: ${error.message}`);
    all.push(...((data ?? []) as OnlineRow[]).map(normalizeOnline));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * 온라인 당월 집계 — 브랜드 랭킹 + 지점 랭킹 (전년동월비 포함)
 * @param ym 당월 'YYYY-MM'  @param prevYm 전년동월 'YYYY-MM'
 */
async function getOnlineMonthImpl(ym: string, prevYm: string) {
  const rows = await fetchOnline([ym, prevYm]);

  function rank(
    keyOf: (r: OnlineRow) => string, withCat: boolean,
    subOf?: (r: OnlineRow) => string,
  ): OnlineRank[] {
    const cur = new Map<string, { s: number; cat: string; ch: Map<string, number>; sub: Map<string, number> }>();
    const prev = new Map<string, { s: number; cat: string }>();
    const prevSub = new Map<string, Map<string, number>>();   // 전년 하위(지점/브랜드) — 하위 퇴점 노출용
    for (const r of rows) {
      const k = keyOf(r);
      if (r.ym === ym) {
        const e = cur.get(k) ?? { s: 0, cat: r.cat, ch: new Map(), sub: new Map() };
        e.s += r.sales;
        e.ch.set(r.channel, (e.ch.get(r.channel) ?? 0) + r.sales);
        if (subOf) { const sk = subOf(r); e.sub.set(sk, (e.sub.get(sk) ?? 0) + r.sales); }
        cur.set(k, e);
      } else {
        const e = prev.get(k) ?? { s: 0, cat: r.cat };
        e.s += r.sales; prev.set(k, e);
        if (subOf) { let m = prevSub.get(k); if (!m) { m = new Map(); prevSub.set(k, m); } const sk = subOf(r); m.set(sk, (m.get(sk) ?? 0) + r.sales); }
      }
    }
    const out: OnlineRank[] = [];
    for (const [k, e] of cur) {
      const ps = prev.get(k)?.s ?? 0;
      out.push({
        key: k,
        cat: withCat ? e.cat : undefined,
        s: e.s, ps,
        yoyPct: ps ? +((e.s - ps) / ps * 100).toFixed(1) : 0,
        byChannel: [...e.ch.entries()].map(([channel, s]) => ({ channel, s })).sort((a, b) => b.s - a.s),
        bySub: subOf ? buildSub(e.sub, prevSub.get(k)) : undefined,
      });
    }
    // 퇴점: 전년에만 있고 올해 없는 항목
    for (const [k, pv] of prev) {
      if (cur.has(k)) continue;
      out.push({
        key: k, cat: withCat ? pv.cat : undefined,
        s: 0, ps: pv.s, yoyPct: -100, closed: true,
        byChannel: [], bySub: subOf ? [] : undefined,
      });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  // 채널 / 복종 전체 합계 (당월/전년)
  const chTotals = new Map<string, { s: number; ps: number }>();
  const catTotals = new Map<string, { s: number; ps: number }>();
  for (const r of rows) {
    const ch = chTotals.get(r.channel) ?? { s: 0, ps: 0 };
    const ca = catTotals.get(r.cat) ?? { s: 0, ps: 0 };
    if (r.ym === ym) { ch.s += r.sales; ca.s += r.sales; }
    else { ch.ps += r.sales; ca.ps += r.sales; }
    chTotals.set(r.channel, ch); catTotals.set(r.cat, ca);
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
    cats: [...catTotals.entries()]
      .map(([cat, v]) => ({ cat, ...v, yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.s - a.s),
  };
}

/** 온라인 가용 월 목록 (최신순) — order로 확정 선택, 1000행 제한 영향 없음 */
export async function getOnlineMeta() {
  const supabase = createServiceClient();
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
  const supabase = createServiceClient();
  const all: OnlineCumRow[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("sales_online_cum")
      .select("cat,brand,store,channel,year,sales")
      .in("year", years)
      .order("id", { ascending: true })   // 안정 정렬 — range 페이징 누락/중복 방지
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`sales_online_cum: ${error.message}`);
    all.push(...((data ?? []) as OnlineCumRow[]).map(normalizeOnline));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// 누적에서 제외할 채널 (운영 종료/미사용 — 데이터가 들어와도 무시)
// "지정되지 않음": 채널 미지정 잡행 — 당월 ETL은 이미 거름. 누적도 동일하게 제외해서 두 탭 표시 일치.
const EXCLUDED_CUM_CHANNELS = new Set(["옥션", "G마켓", "지정되지 않음"]);

/**
 * 온라인 누적 집계 — 브랜드/지점 랭킹 (전년 누적비)
 * @param year '2026'  @param prevYear '2025'
 */
async function getOnlineCumulativeImpl(year: string, prevYear: string) {
  const rows = (await fetchOnlineCum([year, prevYear]))
    .filter((r) => !EXCLUDED_CUM_CHANNELS.has(r.channel));

  function rank(
    keyOf: (r: OnlineCumRow) => string, withCat: boolean,
    subOf?: (r: OnlineCumRow) => string,
  ): OnlineRank[] {
    const cur = new Map<string, { s: number; cat: string; ch: Map<string, number>; sub: Map<string, number> }>();
    const prev = new Map<string, { s: number; cat: string }>();
    const prevSub = new Map<string, Map<string, number>>();   // 전년 하위 — 하위 퇴점 노출용
    for (const r of rows) {
      const k = keyOf(r);
      if (r.year === year) {
        const e = cur.get(k) ?? { s: 0, cat: r.cat, ch: new Map(), sub: new Map() };
        e.s += r.sales;
        e.ch.set(r.channel, (e.ch.get(r.channel) ?? 0) + r.sales);
        if (subOf) { const sk = subOf(r); e.sub.set(sk, (e.sub.get(sk) ?? 0) + r.sales); }
        cur.set(k, e);
      } else {
        const e = prev.get(k) ?? { s: 0, cat: r.cat };
        e.s += r.sales; prev.set(k, e);
        if (subOf) { let m = prevSub.get(k); if (!m) { m = new Map(); prevSub.set(k, m); } const sk = subOf(r); m.set(sk, (m.get(sk) ?? 0) + r.sales); }
      }
    }
    const out: OnlineRank[] = [];
    for (const [k, e] of cur) {
      const ps = prev.get(k)?.s ?? 0;
      out.push({
        key: k, cat: withCat ? e.cat : undefined,
        s: e.s, ps, yoyPct: ps ? +((e.s - ps) / ps * 100).toFixed(1) : 0,
        byChannel: [...e.ch.entries()].map(([channel, s]) => ({ channel, s })).sort((a, b) => b.s - a.s),
        bySub: subOf ? buildSub(e.sub, prevSub.get(k)) : undefined,
      });
    }
    // 퇴점: 전년에만 있고 올해 없는 항목
    for (const [k, pv] of prev) {
      if (cur.has(k)) continue;
      out.push({
        key: k, cat: withCat ? pv.cat : undefined,
        s: 0, ps: pv.s, yoyPct: -100, closed: true,
        byChannel: [], bySub: subOf ? [] : undefined,
      });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  const chTotals = new Map<string, { s: number; ps: number }>();
  const catTotals = new Map<string, { s: number; ps: number }>();
  for (const r of rows) {
    const ch = chTotals.get(r.channel) ?? { s: 0, ps: 0 };
    const ca = catTotals.get(r.cat) ?? { s: 0, ps: 0 };
    if (r.year === year) { ch.s += r.sales; ca.s += r.sales; }
    else { ch.ps += r.sales; ca.ps += r.sales; }
    chTotals.set(r.channel, ch); catTotals.set(r.cat, ca);
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
    cats: [...catTotals.entries()]
      .map(([cat, v]) => ({ cat, ...v, yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.s - a.s),
  };
}

/** 온라인 누적 가용 연도 (최신순) — order로 확정 선택 */
export async function getOnlineCumMeta() {
  const supabase = createServiceClient();
  const { data: latest } = await supabase
    .from("sales_online_cum").select("year").order("year", { ascending: false }).limit(1);
  const { data: earliest } = await supabase
    .from("sales_online_cum").select("year").order("year", { ascending: true }).limit(1);
  const max = latest?.[0]?.year ?? null;
  const min = earliest?.[0]?.year ?? null;
  const years = max ? (min && min !== max ? [max, min] : [max]) : [];
  return { years, hasData: !!max };
}

// ── 오프라인 매출 (5번 누적 / 6번 당월) — 매출+이익 ──
export interface OffSub {
  key: string;
  s: number; ps: number;          // 매출 당기/전기
  g: number; pg: number;          // 이익 당기/전기
  growthS: number; growthPct: number;   // 매출 성장액/율
  growthG: number; growthGPct: number;  // 매총익 성장액/율
  area: number;                   // 전용면적(평)
  dppSales: number;               // 일평당매출 (당기)
  prevDppSales: number;           // 일평당매출 (전기)
  dppSalesGrowthPct: number;      // 일평당매출 성장율 %
  storeCnt: number;               // 매장수(참고)
  closed?: boolean;               // 퇴점: 전년 실적만 있고 올해 매출 없음
}
export interface OffRank {
  key: string;
  cat?: string;
  division?: string;
  s: number; ps: number;          // 매출 당기/전기
  g: number; pg: number;          // 이익 당기/전기
  gpm: number;                    // 이익률 %
  yoyPct: number;                 // 매출 전년비
  subCount: number;               // 하위 개수 (브랜드→매장수 / 지점→브랜드수)
  dppSales: number;               // 일평당매출 (당기, 매출/면적합)
  prevDppSales: number;           // 일평당매출 (전기)
  dppSalesGrowthPct: number;      // 일평당매출 성장율 % — 면적변화 제거된 좌판효율 변화
  closed?: boolean;               // 퇴점: 전년 실적만 있고 올해 매출 없음
  bySub?: OffSub[];
}
/** "그 외" 분리 브랜드 묶음 — 본 수치엔 빠지고 별도 탭에서만 노출 */
export interface OffOthers {
  total: number; prevTotal: number; gTotal: number; gpm: number; yoyPct: number;
  brands: OffRank[]; stores: OffRank[]; detailBrands: OffRank[];
}

interface OffRow { division: string; cat: string; brand: string; store: string; sales: number; gp: number; area_raw: number; store_cnt: number; days: number | null; }

async function fetchOff(table: "sales_offline_cum" | "sales_offline_month", col: "year" | "ym", periods: string[]): Promise<(OffRow & { p: string })[]> {
  const supabase = createServiceClient();
  const all: (OffRow & { p: string })[] = [];
  let from = 0; const PAGE = 1000;
  // days 컬럼은 sales_offline_month 에만 존재 (당월 파일 "N일누적" 파싱값).
  const cols = table === "sales_offline_month"
    ? `division,cat,brand,store,sales,gp,area_raw,store_cnt,days,${col}`
    : `division,cat,brand,store,sales,gp,area_raw,store_cnt,${col}`;
  for (;;) {
    const { data, error } = await supabase
      .from(table).select(cols).in(col, periods)
      .order("id", { ascending: true })   // 안정 정렬 — range 페이징 누락/중복 방지
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    // 동적 select 문자열로 인해 data 타입이 GenericStringError로 좁혀지지 못함 → unknown 경유 캐스팅.
    const rows = (data as unknown as Record<string, unknown>[]) ?? [];
    all.push(...rows.map((r) => ({ ...(r as unknown as OffRow), p: r[col] as string })));
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  // 단위 정규화: 당월 area_raw는 ERP가 "평"으로 내려주므로 실제 영업일수만큼 곱해
  // 누적과 동일한 "평·일" 단위로 맞춘다. 우선순위: r.days(파일 "N일누적") → daysInMonth(ym) 캘린더 말일.
  // 6일누적처럼 부분 영업 지점을 반영해야 dpp매출이 실제(94k) 대로 나옴.
  if (table === "sales_offline_month") {
    for (const r of all) r.area_raw = (r.area_raw ?? 0) * (r.days ?? daysInMonth(r.p));
  }
  return all;
}

/** 한 행 묶음(filtered)에 대한 전체 집계 — 본류/그외 동일 로직 재사용 */
function aggregate(filtered: (OffRow & { p: string })[], cur: string, prev: string, days: number) {
  // parea = 전기 면적·일. cur/prev 를 함께 잡아 일평당매출 성장율까지 계산.
  type SubAgg = { s: number; g: number; ps: number; pg: number; area: number; parea: number; cnt: number };
  // 일평당매출 성장율 = (dpp - prevDpp) / prevDpp * 100. prevDpp=0(신규)이면 0으로 두고 UI에서 "신규" 표기.
  const growthDpp = (dpp: number, prev: number) => prev ? +((dpp - prev) / prev * 100).toFixed(1) : 0;
  // keyOf: 그룹 키, labelOf: 표시명(없으면 키와 동일)
  function rank(keyOf: (r: OffRow) => string, withCat: boolean, subOf?: (r: OffRow) => string, labelOf?: (r: OffRow) => string): OffRank[] {
    const c = new Map<string, { s: number; g: number; area: number; parea: number; label: string; cat: string; division: string; sub: Map<string, SubAgg> }>();
    const p = new Map<string, { s: number; g: number; area: number; label: string; cat: string; division: string }>();
    const subEnsure = (m: Map<string, SubAgg>, sk: string) => {
      let e = m.get(sk); if (!e) { e = { s: 0, g: 0, ps: 0, pg: 0, area: 0, parea: 0, cnt: 0 }; m.set(sk, e); } return e;
    };
    for (const r of filtered) {
      const k = keyOf(r);
      if (r.p === cur) {
        const e = c.get(k) ?? { s: 0, g: 0, area: 0, parea: 0, label: labelOf ? labelOf(r) : k, cat: r.cat, division: r.division, sub: new Map() };
        e.s += r.sales; e.g += r.gp; e.area += r.area_raw;
        if (subOf) { const se = subEnsure(e.sub, subOf(r)); se.s += r.sales; se.g += r.gp; se.area += r.area_raw; se.cnt += r.store_cnt; }
        c.set(k, e);
      } else if (r.p === prev) {
        const e = p.get(k) ?? { s: 0, g: 0, area: 0, label: labelOf ? labelOf(r) : k, cat: r.cat, division: r.division };
        e.s += r.sales; e.g += r.gp; e.area += r.area_raw;
        p.set(k, e);
        // 하위(지점)의 전년 값도 누적 — 성장 계산용 (cur 그룹에 미리 있을 수도, 없을 수도)
      }
    }
    // 전년 → cur 그룹에 병합: cur 그룹의 parea 및 sub.parea/ps/pg 채움. 올해 없던 지점도 생성 → 지점 단위 퇴점 노출.
    for (const [k, pv] of p) {
      const e = c.get(k); if (e) e.parea += pv.area;
    }
    for (const r of filtered) {
      if (r.p !== prev || !subOf) continue;
      const k = keyOf(r);
      const e = c.get(k); if (!e) continue;
      const se = subEnsure(e.sub, subOf(r));
      se.ps += r.sales; se.pg += r.gp; se.parea += r.area_raw;
    }
    const out: OffRank[] = [];
    for (const [k, e] of c) {
      const pv = p.get(k) ?? { s: 0, g: 0, area: 0 };
      const dppSales = e.area ? Math.round(e.s / e.area) : 0;
      const prevDppSales = e.parea ? Math.round(pv.s / e.parea) : 0;
      out.push({
        key: e.label, cat: withCat ? e.cat : undefined, division: withCat ? e.division : undefined,
        s: e.s, ps: pv.s, g: e.g, pg: pv.g,
        gpm: e.s ? +(e.g / e.s * 100).toFixed(1) : 0,
        yoyPct: pv.s ? +((e.s - pv.s) / pv.s * 100).toFixed(1) : 0,
        subCount: [...e.sub.values()].filter((v) => v.s > 0).length,   // 운영 중 지점만
        dppSales,
        prevDppSales,
        dppSalesGrowthPct: growthDpp(dppSales, prevDppSales),
        bySub: subOf ? [...e.sub.entries()].map(([key, v]) => {
          const dpp = v.area ? Math.round(v.s / v.area) : 0;
          const pdpp = v.parea ? Math.round(v.ps / v.parea) : 0;
          return {
            key, s: v.s, ps: v.ps, g: v.g, pg: v.pg,
            growthS: v.s - v.ps, growthPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0,
            growthG: v.g - v.pg, growthGPct: v.pg ? +((v.g - v.pg) / v.pg * 100).toFixed(1) : 0,
            area: days ? Math.round(v.area / days) : 0,         // 전용면적(평)
            dppSales: dpp,
            prevDppSales: pdpp,
            dppSalesGrowthPct: growthDpp(dpp, pdpp),
            storeCnt: v.cnt,
            closed: v.s === 0 && v.ps > 0,                      // 지점 단위 퇴점
          };
        }).sort((a, b) => b.s - a.s).slice(0, 50) : undefined,
      });
    }
    // 퇴점: 전년(prev)에는 있었으나 올해(cur)에 없는 항목 — s=0, 전년 실적만 보유
    for (const [k, pv] of p) {
      if (c.has(k)) continue;
      out.push({
        key: pv.label, cat: withCat ? pv.cat : undefined, division: withCat ? pv.division : undefined,
        s: 0, ps: pv.s, g: 0, pg: pv.g,
        gpm: 0, yoyPct: -100, subCount: 0,
        dppSales: 0,
        prevDppSales: pv.area ? Math.round(pv.s / pv.area) : 0,
        dppSalesGrowthPct: -100,
        closed: true,
        bySub: subOf ? [] : undefined,
      });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  // 부문(division)별 요약
  const divMap = new Map<string, { s: number; ps: number; g: number; pg: number }>();
  for (const r of filtered) {
    const e = divMap.get(r.division) ?? { s: 0, ps: 0, g: 0, pg: 0 };
    if (r.p === cur) { e.s += r.sales; e.g += r.gp; }
    else if (r.p === prev) { e.ps += r.sales; e.pg += r.gp; }
    divMap.set(r.division, e);
  }
  // 패션 부문 복종(cat)별 요약
  const fashMap = new Map<string, { s: number; ps: number; g: number; pg: number }>();
  for (const r of filtered) {
    if (r.division !== "패션") continue;
    const e = fashMap.get(r.cat) ?? { s: 0, ps: 0, g: 0, pg: 0 };
    if (r.p === cur) { e.s += r.sales; e.g += r.gp; }
    else if (r.p === prev) { e.ps += r.sales; e.pg += r.gp; }
    fashMap.set(r.cat, e);
  }

  const total = filtered.filter((r) => r.p === cur).reduce((t, r) => t + r.sales, 0);
  const prevTotal = filtered.filter((r) => r.p === prev).reduce((t, r) => t + r.sales, 0);
  const gTotal = filtered.filter((r) => r.p === cur).reduce((t, r) => t + r.gp, 0);

  return {
    total, prevTotal, gTotal,
    gpm: total ? +(gTotal / total * 100).toFixed(1) : 0,
    yoyPct: prevTotal ? +((total - prevTotal) / prevTotal * 100).toFixed(1) : 0,
    brands: rank((r) => r.brand, true, (r) => r.store),
    stores: rank((r) => r.store, false, (r) => r.brand),
    // 상세용: (부문|복종|브랜드) 단위 — 중복부문 브랜드 분리, 부문/복종 합과 정확히 일치
    detailBrands: rank((r) => `${r.division}|${r.cat}|${r.brand}`, true, (r) => r.store, (r) => r.brand),
    divisions: [...divMap.entries()]
      .map(([division, v]) => ({ division, s: v.s, ps: v.ps, g: v.g,
        gpm: v.s ? +(v.g / v.s * 100).toFixed(1) : 0,
        yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.s - a.s),
    fashionCats: [...fashMap.entries()]
      .map(([cat, v]) => ({ cat, s: v.s, ps: v.ps, g: v.g,
        gpm: v.s ? +(v.g / v.s * 100).toFixed(1) : 0,
        yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.s - a.s),
  };
}

/**
 * 본류 집계 + "그 외" 분리 집계.
 * 그 외 브랜드(엠페스트·코코몽키즈랜드·이키즈랜드·문화센터·소극장 등)는
 * 본 수치(총계·부문·복종·지점·브랜드)에서 완전히 제외하고 others로만 노출.
 */
function buildOff(
  rows: (OffRow & { p: string })[], cur: string, prev: string, divisions: string[] | null, days: number,
) {
  const filtered = divisions ? rows.filter((r) => divisions.includes(r.division)) : rows;
  const mainRows = filtered.filter((r) => !isOthersBrand(r.brand));
  const otherRows = filtered.filter((r) => isOthersBrand(r.brand));
  const main = aggregate(mainRows, cur, prev, days);
  const oth = aggregate(otherRows, cur, prev, days);
  const others: OffOthers = {
    total: oth.total, prevTotal: oth.prevTotal, gTotal: oth.gTotal, gpm: oth.gpm, yoyPct: oth.yoyPct,
    brands: oth.brands, stores: oth.stores, detailBrands: oth.detailBrands,
  };
  return { ...main, others };
}

/** 누적 평당 환산 일수 — 해당 연도 1/1 ~ 최신월(ym "YYYYMM") 말일까지 경과일수 */
export function cumDays(year: string, monthYm: string | null): number {
  const y = Number(year);
  if (!monthYm || Number.isNaN(y)) return 181;
  const m = Number(monthYm.replace(/[^0-9]/g, "").slice(4, 6));
  if (!m) return 181;
  const end = new Date(y, m, 0);            // m월 말일 (다음달 0일)
  const start = new Date(y, 0, 1);          // 1/1
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

/** 오프라인 누적 (5번) — 평당 일수는 최신월 기준 자동(미지정 시 181) */
async function getOfflineCumImpl(year: string, prevYear: string, divisions: string[] | null = null, days = 181) {
  const rows = await fetchOff("sales_offline_cum", "year", [year, prevYear]);
  return { year, prevYear, ...buildOff(rows, year, prevYear, divisions, days) };
}

/** 오프라인 당월 (6번) — 평당 일수는 DB days(파일 "N일누적") 우선, 없으면 캘린더 말일 */
async function getOfflineMonthImpl(ym: string, prevYm: string, divisions: string[] | null = null) {
  const rows = await fetchOff("sales_offline_month", "ym", [ym, prevYm]);
  // 표시용 평 복원(area/days)에 쓸 대표 일수 — 당기(ym) 행의 days 우선.
  const curDays = rows.find((r) => r.p === ym && r.days != null)?.days ?? daysInMonth(ym);
  return { ym, prevYm, ...buildOff(rows, ym, prevYm, divisions, curDays) };
}

// ── BCD (등급 분석) ──────────────────────────────────────────
export interface BcdBrand extends OffRank {
  grade: string;        // S/A/B/C/F/'' (미분류)
  prevStores: number;   // 전년 매출 있던 지점 수
}
export interface BcdGradeRow {
  grade: string; brCnt: number; stCnt: number; prevStCnt: number;
  s: number; ps: number; g: number; pg: number; gpm: number; yoyPct: number;
}

const BCD_DIVISIONS = ["패션", "F&B", "기타"];
const GRADE_ORDER = ["S", "A", "B", "C", "F", ""];

/** 브랜드명 정규화 — 괄호(영문만/전체) + 공백 제거, 소문자. */
function normBrandKey(b: string, allParens: boolean): string {
  const re = allParens ? /\([^)]*\)/g : /\([\x20-\x7E]+\)/g;
  return b.replace(re, "").replace(/\s+/g, "").trim().toLowerCase();
}

interface GradeMaps { exact: Map<string, string>; n1: Map<string, string>; n2: Map<string, string>; }

/** 등급표 로드 → 정확맵 + 정규화맵 2종(영문괄호만/전체괄호). 등급이 갈리는 모호 키는 제외. */
async function loadBrandGrades(): Promise<GradeMaps> {
  const supabase = createServiceClient();
  // 전체 행 로드 — 1000행 기본 제한 회피(brand_grade 1400+행). 정렬 후 range 페이징.
  const data: { brand: string; grade: string }[] = [];
  let from = 0; const PAGE = 1000;
  for (;;) {
    const { data: page, error } = await supabase
      .from("brand_grade").select("brand,grade")
      .order("brand", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) break;
    data.push(...(page ?? []) as { brand: string; grade: string }[]);
    if (!page || page.length < PAGE) break;
    from += PAGE;
  }
  const exact = new Map<string, string>();
  const s1 = new Map<string, Set<string>>();
  const s2 = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { brand: string; grade: string }[]) {
    const g = r.grade || "";
    exact.set(r.brand, g);
    for (const [set, all] of [[s1, false], [s2, true]] as const) {
      const k = normBrandKey(r.brand, all);
      if (!k) continue;
      (set.get(k) ?? set.set(k, new Set()).get(k)!).add(g);
    }
  }
  const dedupe = (sets: Map<string, Set<string>>) => {
    const m = new Map<string, string>();
    for (const [k, set] of sets) if (set.size === 1) m.set(k, [...set][0]);
    return m;
  };
  return { exact, n1: dedupe(s1), n2: dedupe(s2) };
}
/** 정확 → 영문괄호 정규화 → 전체괄호 정규화 순으로 등급 매칭 */
function gradeOf(brand: string, m: GradeMaps): string {
  return m.exact.get(brand)
    ?? m.n1.get(normBrandKey(brand, false))
    ?? m.n2.get(normBrandKey(brand, true))
    ?? "";
}

// BCD에서 아예 제외하는 공통풀 의사 브랜드(패션공통·킴스공통 등)
const isPoolBrand = (name: string): boolean =>
  name.includes("패션공통") || name.includes("킴스공통") || name.includes("킴스클럽공통");

/** 오프라인 집계(detailBrands)에 등급을 입혀 BCD 요약·점수 산출 */
function overlayBcd(off: Awaited<ReturnType<typeof getOfflineCumImpl>>, gm: GradeMaps) {
  const brands: BcdBrand[] = off.detailBrands
    .filter((b) => !b.closed && b.s > 0 && !isPoolBrand(b.key))
    .map((b) => ({ ...b, grade: gradeOf(b.key, gm), prevStores: (b.bySub ?? []).filter((s) => s.ps > 0).length }));

  const map = new Map<string, BcdGradeRow>();
  for (const b of brands) {
    const e = map.get(b.grade) ?? { grade: b.grade, brCnt: 0, stCnt: 0, prevStCnt: 0, s: 0, ps: 0, g: 0, pg: 0, gpm: 0, yoyPct: 0 };
    e.brCnt++; e.stCnt += b.subCount; e.prevStCnt += b.prevStores;
    e.s += b.s; e.ps += b.ps; e.g += b.g; e.pg += b.pg;
    map.set(b.grade, e);
  }
  const byGrade = [...map.values()]
    .map((e) => ({ ...e, gpm: e.s ? +(e.g / e.s * 100).toFixed(1) : 0, yoyPct: e.ps ? +((e.s - e.ps) / e.ps * 100).toFixed(1) : 0 }))
    .sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));

  const totalStores = brands.reduce((t, b) => t + b.subCount, 0);
  const prevTotalStores = brands.reduce((t, b) => t + b.prevStores, 0);
  const isAB = (g: string) => g === "A" || g === "B";
  const abStores = brands.filter((b) => isAB(b.grade)).reduce((t, b) => t + b.subCount, 0);
  const abPrevStores = brands.filter((b) => isAB(b.grade)).reduce((t, b) => t + b.prevStores, 0);
  const bcdScore = totalStores ? +(abStores / totalStores * 100).toFixed(1) : 0;
  const bcdScorePrev = prevTotalStores ? +(abPrevStores / prevTotalStores * 100).toFixed(1) : 0;

  return {
    total: off.total, prevTotal: off.prevTotal, gTotal: off.gTotal, gpm: off.gpm, yoyPct: off.yoyPct,
    divisions: off.divisions, fashionCats: off.fashionCats,
    brands, byGrade,
    bcdScore, bcdScorePrev, bcdDiff: +(bcdScore - bcdScorePrev).toFixed(1),
    abStores, totalStores,
    unmatched: brands.filter((b) => !b.grade).length,
  };
}

// BCD 집계는 캐시하지 않음(등급 편집 즉시 반영). 비싼 오프라인 조회는 캐시된 getOfflineCum/Month 재사용,
// 등급표는 매 호출 fresh 로드 → 관리자 등급 변경이 router.refresh 한 번에 반영됨.
export async function getBcdCum(year: string, prevYear: string, days = 181) {
  const [off, gm] = await Promise.all([getOfflineCum(year, prevYear, BCD_DIVISIONS, days), loadBrandGrades()]);
  return { periodLabel: `${year} 누적`, prevLabel: `${prevYear} 누적`, ...overlayBcd(off, gm) };
}
export async function getBcdMonth(ym: string, prevYm: string) {
  const [off, gm] = await Promise.all([getOfflineMonth(ym, prevYm, BCD_DIVISIONS), loadBrandGrades()]);
  return { periodLabel: ym, prevLabel: prevYm, ...overlayBcd(off as unknown as Awaited<ReturnType<typeof getOfflineCumImpl>>, gm) };
}

// ── 캐싱 (서비스 클라이언트 기반, 인자별 60초) ──
// 인자(연/월)가 달라지면 새 캐시키 → 새 월 데이터는 즉시 반영.
// 같은 월 재import 정정은 최대 60초 후 반영. 즉시 무효화는 revalidateTag("sales").
export const getOnlineMonth = unstable_cache(getOnlineMonthImpl, ["online-month"], { revalidate: 60, tags: ["sales"] });
export const getOnlineCumulative = unstable_cache(getOnlineCumulativeImpl, ["online-cum"], { revalidate: 60, tags: ["sales"] });
export const getOfflineCum = unstable_cache(getOfflineCumImpl, ["offline-cum"], { revalidate: 60, tags: ["sales"] });
export const getOfflineMonth = unstable_cache(getOfflineMonthImpl, ["offline-month"], { revalidate: 60, tags: ["sales"] });

/** 오프라인 가용 기간
 *
 * cumThroughYm: 누적 마감월('YYYY-MM'). 누적 파일 업로드 시 form의 기준월이 각 행에 저장되어
 * 당월 테이블(monthYm)이 앞서가도 누적 개월수를 정확히 반영한다. legacy 행은 null.
 * 호출부는 `cumThroughYm ?? monthYm` 폴백을 사용해야 한다. */
export async function getOfflineMeta() {
  const supabase = createServiceClient();
  const [{ data: cy }, { data: my }] = await Promise.all([
    supabase.from("sales_offline_cum").select("year, through_ym").order("year", { ascending: false }).limit(1),
    supabase.from("sales_offline_month").select("ym").order("ym", { ascending: false }).limit(1),
  ]);
  return {
    cumYear: cy?.[0]?.year ?? null,
    monthYm: my?.[0]?.ym ?? null,
    cumThroughYm: (cy?.[0]?.through_ym as string | null | undefined) ?? null,
  };
}

/** 데이터 존재 여부 + 가용 기간 + 부문 목록 (UI 초기화용) */
export async function getSalesMeta() {
  const supabase = createServiceClient();
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
