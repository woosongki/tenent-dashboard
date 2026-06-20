import "server-only";
import { getOfflineMeta, getOfflineCum, getOfflineMonth } from "@/lib/sales/queries";
import { displayDivision, displayCat, divisionRank } from "@/lib/sales/labels";

const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];

export interface BrandMove { brand: string; cat: string; s: number; yoyPct: number; }
export interface DivisionRow { division: string; s: number; yoyPct: number; }

export interface SalesOverview {
  cumLabel: string;
  monthLabel: string;
  cumTotal: number; cumPrev: number; cumYoy: number;
  monthTotal: number | null; monthYoy: number | null;
  divisions: DivisionRow[];
  topGrowth: BrandMove[];
  topDecline: BrandMove[];
  closedCount: number;   // 완전 퇴점 (올해 누적 0)
  leftCount: number;     // 이탈 (누적 있으나 당월 빠짐)
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
  if (meta.monthYm) {
    const pym = `${Number(meta.monthYm.slice(0, 4)) - 1}${meta.monthYm.slice(4)}`;
    const month = await getOfflineMonth(meta.monthYm, pym, OFFLINE_DIVISIONS);
    monthTotal = month.total;
    monthYoy = month.yoyPct;
    monthActive = new Set(month.brands.filter((b) => b.s > 0).map((b) => b.key));
  }

  const brands = cum.brands;
  const closedCount = brands.filter((b) => b.closed).length;
  const leftCount = meta.monthYm
    ? brands.filter((b) => !b.closed && b.s > 0 && !monthActive.has(b.key)).length
    : 0;

  const map = (b: typeof brands[number]): BrandMove => ({ brand: b.key, cat: displayCat(b.cat), s: b.s, yoyPct: b.yoyPct });
  const comparable = brands.filter((b) => !b.closed && b.s > 0 && b.ps > 0);
  const topGrowth = [...comparable].sort((a, b) => b.yoyPct - a.yoyPct).slice(0, 5).map(map);
  const topDecline = [...comparable].sort((a, b) => a.yoyPct - b.yoyPct).slice(0, 5).map(map);

  const divisions = [...cum.divisions]
    .sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
    .map((d) => ({ division: displayDivision(d.division), s: d.s, yoyPct: d.yoyPct }));

  return {
    cumLabel: `${meta.cumYear} 누적`,
    monthLabel: meta.monthYm ?? "",
    cumTotal: cum.total, cumPrev: cum.prevTotal, cumYoy: cum.yoyPct,
    monthTotal, monthYoy,
    divisions, topGrowth, topDecline, closedCount, leftCount,
  };
}
