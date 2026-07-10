import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOfflineMeta, getOfflineCum, cumDays } from "@/lib/sales/queries";
import type { AttractionMatch, VendorMatch, SalesBenchmark } from "./types";

// ─────────────────────────────────────────────────────────────
// C1. 기존 입점 이력 매칭
// ─────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase();
}

function nameMatches(target: string, candidate: string): boolean {
  const t = normalize(target);
  const c = normalize(candidate);
  if (!t || !c) return false;
  return t.includes(c) || c.includes(t);
}

export async function findExistingTenancy(
  companyName: string,
  brandAlias?: string | null
): Promise<{ attraction: AttractionMatch[]; vendor: VendorMatch[] }> {
  const targets = [companyName, brandAlias].filter(Boolean) as string[];
  if (targets.length === 0) return { attraction: [], vendor: [] };

  try {
    const supabase = await createClient();

    // 매칭에 필요한 컬럼만 명시 (egress 절감)
    const [attractionRes, fnbRes, leaseRes] = await Promise.all([
      supabase.from("attraction_status").select("brand_name, branch, floor, category, manager, is_completed, memo, notion_url"),
      supabase.from("vendor_fnb").select("name, types, score, status, link, contact, keyman, memo"),
      supabase.from("vendor_lease").select("name, types, status, link, contact, keyman, memo"),
    ]);

    const attractionRows = (attractionRes.data ?? []) as Array<{
      brand_name: string;
      branch: string | null;
      floor: string | null;
      category: string | null;
      manager: string | null;
      is_completed: boolean;
      memo: string | null;
      notion_url: string | null;
    }>;
    const fnbRows = (fnbRes.data ?? []) as Array<{
      name: string;
      types: string[] | null;
      score: string | null;
      status: string | null;
      link: string | null;
      contact: string | null;
      keyman: string | null;
      memo: string | null;
    }>;
    const leaseRows = (leaseRes.data ?? []) as Array<{
      name?: string;
      category?: string;
      contact?: string;
      keyman?: string;
      memo?: string;
      status?: string;
    }>;

    const attraction: AttractionMatch[] = attractionRows
      .filter((r) => targets.some((t) => nameMatches(t, r.brand_name)))
      .map((r) => ({
        brandName: r.brand_name,
        branch: r.branch,
        floor: r.floor,
        category: r.category,
        manager: r.manager,
        status: r.is_completed ? "완료" : "진행 중",
        memo: r.memo,
        notionUrl: r.notion_url,
      }));

    const vendor: VendorMatch[] = [
      ...fnbRows
        .filter((r) => targets.some((t) => nameMatches(t, r.name)))
        .map((r) => ({
          name: r.name,
          source: "F&B" as const,
          category: r.types?.join(", ") ?? null,
          status: r.status ?? null,
          score: r.score ?? null,
          keyman: r.keyman ?? null,
          contact: r.contact ?? null,
          memo: r.memo ?? null,
        })),
      ...leaseRows
        .filter((r) => r.name && targets.some((t) => nameMatches(t, r.name!)))
        .map((r) => ({
          name: r.name!,
          source: "일반임대" as const,
          category: r.category ?? null,
          status: r.status ?? null,
          score: null,
          keyman: r.keyman ?? null,
          contact: r.contact ?? null,
          memo: r.memo ?? null,
        })),
    ];

    return { attraction, vendor };
  } catch {
    return { attraction: [], vendor: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// C2. 매출 벤치마크 (Supabase 오프라인 누적 = 매출분석과 동일 소스)
//   예전엔 정적 data/sales/brand-sales.json(월 1회 커밋)을 읽었으나, 매출이
//   Supabase로 이관되어 낡은 스냅샷을 참조하는 문제 → getOfflineCum 재사용으로 전환.
//   피어 그룹은 구 '구매그룹' 대신 Supabase의 복종(cat) 기준.
// ─────────────────────────────────────────────────────────────
export async function buildSalesBenchmark(
  companyName: string,
  brandAlias?: string | null
): Promise<SalesBenchmark | null> {
  try {
    const meta = await getOfflineMeta();
    if (!meta.cumYear) return null;
    const prevYear = String(Number(meta.cumYear) - 1);
    const throughYm = meta.cumThroughYm ?? meta.monthYm;
    const cum = await getOfflineCum(meta.cumYear, prevYear, null, cumDays(meta.cumYear, throughYm));

    // 전체 브랜드(본류 + '그 외') — OffRank: key=브랜드명, cat=복종, s/ps=매출 당기/전기, g=이익 당기, yoyPct=매출 전년비
    const allBrands = [...cum.brands, ...cum.others.brands];
    const targets = [companyName, brandAlias].filter(Boolean) as string[];

    // 1) 동일 브랜드가 자체 매출 데이터에 있는지 (이미 입점 중이라는 강한 신호)
    const ourBrand = allBrands.find((b) => targets.some((t) => nameMatches(t, b.key)));

    // 2) 피어 그룹 = 복종(cat). 이미 입점 중이면 그 복종의 브랜드들과 비교.
    const cat = ourBrand?.cat ?? null;
    const peerBrands = cat ? allBrands.filter((b) => b.cat === cat) : [];
    const peerAvg = peerBrands.length > 0
      ? {
          revenue: peerBrands.reduce((s, b) => s + b.s, 0) / peerBrands.length,
          margin: peerBrands.reduce((s, b) => s + (b.s > 0 ? (b.g / b.s) * 100 : 0), 0) / peerBrands.length,
          growth: peerBrands.reduce((s, b) => s + b.yoyPct, 0) / peerBrands.length,
        }
      : null;

    return {
      ourBrandFound: !!ourBrand,
      ourBrandStats: ourBrand
        ? {
            name: ourBrand.key,
            revenueWon: ourBrand.s,
            marginPct: ourBrand.s > 0 ? (ourBrand.g / ourBrand.s) * 100 : 0,
            revenueGrowth: ourBrand.yoyPct,
          }
        : null,
      groupName: cat,
      groupCode: cat,
      peerCount: peerBrands.length,
      peerAvgRevenueWon: peerAvg?.revenue ?? null,
      peerAvgMarginPct: peerAvg?.margin ?? null,
      peerAvgGrowthPct: peerAvg?.growth ?? null,
      overall: {
        totalRevenueWon: cum.total,
        avgMarginPct: cum.total > 0 ? (cum.gTotal / cum.total) * 100 : 0,
        revenueGrowthPct: cum.yoyPct,
      },
    };
  } catch {
    return null;
  }
}
