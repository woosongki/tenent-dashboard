import "server-only";
import { getOfflineMeta, getOfflineCum, getOfflineMonth, cumDays } from "@/lib/sales/queries";
import { displayDivision, displayCat, divisionRank, catRank, isHiddenCat } from "@/lib/sales/labels";

const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];

export interface DivisionRow { division: string; s: number; yoyPct: number; }
export interface Mover { brand: string; s: number; growth: number; }
export interface CatMovers { category: string; brands: Mover[] }   // 지정 기준으로 desc 정렬된 전체

export interface SalesOverview {
  cumLabel: string;
  monthLabel: string;
  cumTotal: number; cumPrev: number; cumYoy: number;
  monthTotal: number | null; monthYoy: number | null;
  divisions: DivisionRow[];
  catMoversBySales: CatMovers[];    // 당월 매출액 기준
  catMoversByGrowth: CatMovers[];   // 당월 성장액(올해−전년동월) 기준
  closedCount: number;      // 완전 퇴점 (올해 누적 0)
  leftCount: number;        // 이탈 (누적 있으나 당월 빠짐)
}

/** 대시보드 홈용 라이브 오프라인 매출 요약 (Supabase 기준) */
export async function getSalesOverview(): Promise<SalesOverview | null> {
  const meta = await getOfflineMeta();
  if (!meta.cumYear) return null;

  const py = String(Number(meta.cumYear) - 1);
  const cum = await getOfflineCum(meta.cumYear, py, OFFLINE_DIVISIONS, cumDays(meta.cumYear, meta.monthYm));

  let monthTotal: number | null = null;
  let monthYoy: number | null = null;
  let monthActive = new Set<string>();
  let monthDetail: typeof cum.detailBrands = [];
  if (meta.monthYm) {
    const pym = `${Number(meta.monthYm.slice(0, 4)) - 1}${meta.monthYm.slice(4)}`;
    const month = await getOfflineMonth(meta.monthYm, pym, OFFLINE_DIVISIONS);
    monthTotal = month.total;
    monthYoy = month.yoyPct;
    monthActive = new Set(month.brands.filter((b) => b.s > 0).map((b) => b.key));
    monthDetail = month.detailBrands;
  }

  const brands = cum.brands;
  const closedCount = brands.filter((b) => b.closed).length;
  const leftCount = meta.monthYm
    ? brands.filter((b) => !b.closed && b.s > 0 && !monthActive.has(b.key)).length
    : 0;

  // 카테고리(복종 + F&B/라이프스타일)별 당월 브랜드 수집 — 당월 detailBrands 기준
  const catMap = new Map<string, { order: number; rows: { brand: string; s: number; ps: number }[] }>();
  for (const b of monthDetail) {
    if (b.s <= 0) continue;                            // 당월 매출 있는 브랜드만
    if (isHiddenCat(b.cat)) continue;                  // "패션공통" 제외
    const isFashion = b.division === "패션";
    const category = isFashion ? displayCat(b.cat) : displayDivision(b.division ?? "");
    const order = isFashion ? catRank(b.cat) : 100 + divisionRank(b.division ?? "");
    let e = catMap.get(category);
    if (!e) { e = { order, rows: [] }; catMap.set(category, e); }
    e.rows.push({ brand: b.key, s: b.s, ps: b.ps });
  }
  const sortedCats = [...catMap.entries()].sort((a, b) => a[1].order - b[1].order);
  const toMover = (r: { brand: string; s: number; ps: number }): Mover => ({ brand: r.brand, s: r.s, growth: r.s - r.ps });

  // 매출액 기준 (전체)
  const catMoversBySales: CatMovers[] = sortedCats.map(([category, e]) => ({
    category,
    brands: [...e.rows].sort((x, y) => y.s - x.s).map(toMover),
  }));
  // 성장액 기준 (전년동월 실적 있는 브랜드만)
  const catMoversByGrowth: CatMovers[] = sortedCats
    .map(([category, e]) => ({
      category,
      brands: e.rows.filter((r) => r.ps > 0).sort((x, y) => (y.s - y.ps) - (x.s - x.ps)).map(toMover),
    }))
    .filter((c) => c.brands.length > 0);

  const divisions = [...cum.divisions]
    .sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
    .map((d) => ({ division: displayDivision(d.division), s: d.s, yoyPct: d.yoyPct }));

  return {
    cumLabel: `${meta.cumYear} 누적`,
    monthLabel: meta.monthYm ?? "",
    cumTotal: cum.total, cumPrev: cum.prevTotal, cumYoy: cum.yoyPct,
    monthTotal, monthYoy,
    divisions, catMoversBySales, catMoversByGrowth, closedCount, leftCount,
  };
}
