import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface SearchResult {
  type: "goal" | "vendor" | "market" | "attraction";
  id: string;
  label: string;
  description: string;
  href: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

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

  // 3. Market price
  const { data: markets } = await supabase
    .from("market_price_data")
    .select("id, name, brand, region")
    .ilike("name", pat)
    .limit(5);
  markets?.forEach((m) => {
    results.push({
      type: "market",
      id: m.id as string,
      label: m.name as string,
      description: `상권분석 · ${m.brand ?? "—"}${m.region ? ` · ${m.region}` : ""}`,
      href: `/dashboard/logs`,
    });
  });

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
