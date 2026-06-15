import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  SalesStoreMeta, AggRow, SummaryByCat, CatSummary, Cat, Grade, BCat,
} from "./types";

// ── 기간 유틸 ──
/** 'YYYY-MM' 1년 전 */
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

// 영업일수 추정 (평당/일 지표용) — 월수 × 30일
const DAYS_PER_MONTH = 30;

interface MonthlyAgg { sales: number; gp: number; }

/** 기간 매출/이익을 (cat|brand|store) 키로 합산 */
async function sumByStore(cats: Cat[] | null, yms: string[]) {
  const supabase = await createClient();
  const map = new Map<string, MonthlyAgg>();
  // ym IN (...) — 청크로 안전하게
  let q = supabase.from("sales_monthly").select("cat,brand,store,sales,gp,ym").in("ym", yms);
  if (cats) q = q.in("cat", cats);
  const { data, error } = await q;
  if (error) throw new Error(`sales_monthly: ${error.message}`);
  for (const r of data ?? []) {
    const k = `${r.cat}|${r.brand}|${r.store}`;
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
    .select("cat,brand,store,area,grade,bcat");
  if (error) throw new Error(`sales_store_meta: ${error.message}`);
  const map = new Map<string, SalesStoreMeta>();
  for (const r of data ?? []) {
    map.set(`${r.cat}|${r.brand}|${r.store}`, {
      cat: r.cat as Cat, brand: r.brand, store: r.store,
      area: Number(r.area), grade: (r.grade ?? "") as Grade, bcat: (r.bcat ?? "") as BCat,
    });
  }
  return map;
}

/**
 * 기간 집계 → AggRow[] (당기 vs 전년동기, 평당지표 포함)
 * @param start 'YYYY-MM'  @param end 'YYYY-MM'
 */
export async function getAggRows(
  start: string, end: string, cats: Cat[] | null = null,
): Promise<AggRow[]> {
  const curYms = ymRange(start, end);
  const prevYms = curYms.map(prevYearYm);
  const months = curYms.length;
  const days = months * DAYS_PER_MONTH;

  const [cur, prev, meta] = await Promise.all([
    sumByStore(cats, curYms),
    sumByStore(cats, prevYms),
    getMetaMap(),
  ]);

  const rows: AggRow[] = [];
  for (const [k, c] of cur) {
    const [cat, brand, store] = k.split("|");
    const p = prev.get(k) ?? { sales: 0, gp: 0 };
    const m = meta.get(k);
    const area = m?.area ?? 0;
    const dayArea = area * days;
    rows.push({
      cat: cat as Cat, brand, store,
      s: c.sales, ps: p.sales, g: c.gp, pg: p.gp,
      gpm: c.sales ? +(c.gp / c.sales * 100).toFixed(1) : 0,
      area,
      spd: dayArea ? Math.round(c.sales / dayArea) : 0,
      pspd: dayArea ? Math.round(p.sales / dayArea) : 0,
      gpd: dayArea ? Math.round(c.gp / dayArea) : 0,
      pgpd: dayArea ? Math.round(p.gp / dayArea) : 0,
      grade: m?.grade ?? "", bcat: m?.bcat ?? "",
      yoyPct: p.sales ? +((c.sales - p.sales) / p.sales * 100).toFixed(1) : 0,
    });
  }
  return rows.sort((a, b) => b.s - a.s);
}

/** AggRow[] → 복종별 요약 (전체/여성/영캐) */
export function summarize(rows: AggRow[]): SummaryByCat {
  const mk = (rs: AggRow[]): CatSummary => {
    const s = rs.reduce((t, r) => t + r.s, 0);
    const g = rs.reduce((t, r) => t + r.g, 0);
    const area = rs.reduce((t, r) => t + r.area, 0);
    return {
      s, g, gpm: s ? +(g / s * 100).toFixed(1) : 0, area,
      spd: area ? Math.round(s / area / DAYS_PER_MONTH) : 0,
      gpd: area ? Math.round(g / area / DAYS_PER_MONTH) : 0,
      stores: rs.length,
    };
  };
  return {
    "전체": mk(rows),
    "여성": mk(rows.filter((r) => r.cat === "여성")),
    "영캐": mk(rows.filter((r) => r.cat === "영캐")),
  };
}

/** 데이터 존재 여부 + 가용 기간 (UI 초기화용) */
export async function getSalesMeta() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_monthly")
    .select("ym")
    .order("ym", { ascending: true })
    .limit(1);
  const { data: last } = await supabase
    .from("sales_monthly")
    .select("ym")
    .order("ym", { ascending: false })
    .limit(1);
  if (error) return { hasData: false, minYm: null, maxYm: null };
  return {
    hasData: (data?.length ?? 0) > 0,
    minYm: data?.[0]?.ym ?? null,
    maxYm: last?.[0]?.ym ?? null,
  };
}
