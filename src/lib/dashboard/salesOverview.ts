import "server-only";
import { getOfflineMeta, getOfflineCum, getOfflineMonth } from "@/lib/sales/queries";
import { displayDivision, displayCat, divisionRank, catRank, isHiddenCat } from "@/lib/sales/labels";

const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];

export interface DivisionRow { division: string; s: number; yoyPct: number; }
export interface Mover { brand: string; growth: number; s: number; }
export interface CatMovers { category: string; brands: Mover[] }   // 성장액 desc, 최대 5

export interface SalesOverview {
  cumLabel: string;
  monthLabel: string;
  cumTotal: number; cumPrev: number; cumYoy: number;
  monthTotal: number | null; monthYoy: number | null;
  divisions: DivisionRow[];
  catMovers: CatMovers[];   // 카테고리별 당월 성장액 대표 브랜드
  closedCount: number;      // 완전 퇴점 (올해 누적 0)
  leftCount: number;        // 이탈 (누적 있으나 당월 빠짐)
}

/** 대시보드 홈용 라이브 오프라인 매출 요약 (Supabase 기준) */
export async function getSalesOverview(): Promise<SalesOverview | null> {
  const meta = await getOfflineMeta();
  if (!meta.cumYear) return null;

  const py = String(Number(meta.cumYear) - 1);
  const cum = await getOfflineCum(meta.cumYear, py, OFFLINE_DIVISIONS);

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

  // 카테고리(복종 + F&B/라이프스타일)별 "당월" 성장액 대표 브랜드 — 당월 detailBrands 기준
  const catMap = new Map<string, { order: number; brands: Mover[] }>();
  for (const b of monthDetail) {
    if (b.closed || b.s <= 0 || b.ps <= 0) continue;   // 당월 올해·전년동월 모두 있어야 비교
    if (isHiddenCat(b.cat)) continue;                  // "패션공통" 제외
    const isFashion = b.division === "패션";
    const category = isFashion ? displayCat(b.cat) : displayDivision(b.division ?? "");
    const order = isFashion ? catRank(b.cat) : 100 + divisionRank(b.division ?? "");
    let e = catMap.get(category);
    if (!e) { e = { order, brands: [] }; catMap.set(category, e); }
    e.brands.push({ brand: b.key, growth: b.s - b.ps, s: b.s });
  }
  const catMovers: CatMovers[] = [...catMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([category, e]) => ({
      category,
      brands: [...e.brands].sort((x, y) => y.growth - x.growth).slice(0, 5),
    }));

  const divisions = [...cum.divisions]
    .sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
    .map((d) => ({ division: displayDivision(d.division), s: d.s, yoyPct: d.yoyPct }));

  return {
    cumLabel: `${meta.cumYear} 누적`,
    monthLabel: meta.monthYm ?? "",
    cumTotal: cum.total, cumPrev: cum.prevTotal, cumYoy: cum.yoyPct,
    monthTotal, monthYoy,
    divisions, catMovers, closedCount, leftCount,
  };
}
