import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@/lib/supabase/server";
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
// C2. 매출 벤치마크 (자체 brand-sales.json)
// ─────────────────────────────────────────────────────────────
interface BrandSalesData {
  overallTotal: {
    revenue_current: number;
    revenue_prev: number;
    revenue_growth: number;
    profit_current: number;
    profit_prev: number;
    profit_growth: number;
  };
  groups: Array<{
    code: string;
    name: string;
    revenue_current: number;
    revenue_prev: number;
    revenue_growth: number;
    profit_current: number;
    profit_prev: number;
    profit_growth: number;
    brandCount: number;
  }>;
  brands: Array<{
    groupCode: string;
    groupName: string;
    name: string;
    summary: {
      revenue_current: number;
      revenue_prev: number;
      revenue_growth: number;
      profit_current: number;
      profit_prev: number;
      profit_growth: number;
    };
  }>;
}

let brandSalesCache: BrandSalesData | null = null;

function loadBrandSales(): BrandSalesData | null {
  if (brandSalesCache) return brandSalesCache;
  try {
    const filePath = join(process.cwd(), "data", "sales", "brand-sales.json");
    brandSalesCache = JSON.parse(readFileSync(filePath, "utf-8")) as BrandSalesData;
    return brandSalesCache;
  } catch {
    return null;
  }
}

export function buildSalesBenchmark(
  companyName: string,
  brandAlias?: string | null
): SalesBenchmark | null {
  const data = loadBrandSales();
  if (!data) return null;
  const targets = [companyName, brandAlias].filter(Boolean) as string[];

  // 1) 동일 브랜드가 자체 매출 데이터에 있는지 (이미 입점 중이라는 강한 신호)
  const ourBrand = data.brands.find((b) => targets.some((t) => nameMatches(t, b.name)));

  // 2) 카테고리(group) 추정 — 이미 입점 중이면 해당 group, 아니면 전체 평균과만 비교
  let group: BrandSalesData["groups"][number] | null = null;
  if (ourBrand) {
    group = data.groups.find((g) => g.code === ourBrand.groupCode) ?? null;
  }

  // 그룹 내 평균 (입점 브랜드들의 평균)
  const peerBrands = group ? data.brands.filter((b) => b.groupCode === group!.code) : [];
  const peerAvg = peerBrands.length > 0
    ? {
        revenue: peerBrands.reduce((s, b) => s + b.summary.revenue_current, 0) / peerBrands.length,
        margin: peerBrands.reduce((s, b) => s + (b.summary.revenue_current > 0 ? (b.summary.profit_current / b.summary.revenue_current) * 100 : 0), 0) / peerBrands.length,
        growth: peerBrands.reduce((s, b) => s + b.summary.revenue_growth, 0) / peerBrands.length,
      }
    : null;

  return {
    ourBrandFound: !!ourBrand,
    ourBrandStats: ourBrand
      ? {
          name: ourBrand.name,
          revenueWon: ourBrand.summary.revenue_current,
          marginPct: ourBrand.summary.revenue_current > 0 ? (ourBrand.summary.profit_current / ourBrand.summary.revenue_current) * 100 : 0,
          revenueGrowth: ourBrand.summary.revenue_growth,
        }
      : null,
    groupName: group?.name ?? null,
    groupCode: group?.code ?? null,
    peerCount: peerBrands.length,
    peerAvgRevenueWon: peerAvg?.revenue ?? null,
    peerAvgMarginPct: peerAvg?.margin ?? null,
    peerAvgGrowthPct: peerAvg?.growth ?? null,
    overall: {
      totalRevenueWon: data.overallTotal.revenue_current,
      avgMarginPct: data.overallTotal.revenue_current > 0 ? (data.overallTotal.profit_current / data.overallTotal.revenue_current) * 100 : 0,
      revenueGrowthPct: data.overallTotal.revenue_growth,
    },
  };
}
