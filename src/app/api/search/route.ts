import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/auth/guards";

export interface SearchResult {
  type: "goal" | "vendor" | "store" | "attraction";
  id: string;
  label: string;
  description: string;
  href: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const g = await requireApproved();
  if (!g.ok) return NextResponse.json({ results: [] }, { status: g.response.status });

  const supabase = await createClient();
  const pat = `%${q}%`;
  const results: SearchResult[] = [];

  // 1. Goals (라이프스타일/팝업)
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, category, pool_type")
    .ilike("title", pat)
    .limit(5);
  goals?.forEach((g) => {
    results.push({
      type: "goal",
      id: g.id as string,
      label: g.title as string,
      description: `목표 · ${g.category}`,
      href: `/dashboard/goals?tab=${g.pool_type ?? "lifestyle"}`,
    });
  });

  // 2. Vendor F&B
  const { data: vendors } = await supabase
    .from("vendor_fnb")
    .select("id, name, status, keyman")
    .or(`name.ilike.${pat},keyman.ilike.${pat}`)
    .limit(5);
  vendors?.forEach((v) => {
    results.push({
      type: "vendor",
      id: v.id as string,
      label: v.name as string,
      description: `F&B 업체 · ${v.status ?? "—"}${v.keyman ? ` · ${v.keyman}` : ""}`,
      href: `/dashboard/goals?tab=fnb`,
    });
  });

  // 3. Stores (이랜드리테일 41개 점포 — 정적 데이터)
  try {
    const { searchStoresByQuery } = await import("@/lib/stores");
    const matches = searchStoresByQuery(q, 5);
    matches.forEach((s) => {
      results.push({
        type: "store",
        id: s.id,
        label: `${s.brand} ${s.name}`,
        description: `상권분석 · ${s.region1} ${s.region2}`,
        href: `/dashboard/branch/${s.id}`,
      });
    });
  } catch {
    // stores 로더 실패는 검색 전체를 막지 않음
  }

  // 4. Attraction (입점계획)
  const { data: attractions } = await supabase
    .from("attraction_items")
    .select("id, brand_name, branch, category")
    .ilike("brand_name", pat)
    .limit(5);
  attractions?.forEach((a) => {
    results.push({
      type: "attraction",
      id: a.id as string,
      label: a.brand_name as string,
      description: `입점계획 · ${a.branch ?? "—"}${a.category ? ` · ${a.category}` : ""}`,
      href: `/dashboard/drilldown`,
    });
  });

  return NextResponse.json({ results });
}
