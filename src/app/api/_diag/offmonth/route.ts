import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";
import { getOfflineMeta, getOfflineMonth } from "@/lib/sales/queries";
import { isOthersBrand } from "@/lib/sales/labels";

// 진단 전용 — 프로덕션에서 fashionCats/divisions 축소 원인 규명.
// 앱과 동일 경로(getOfflineMonth = unstable_cache) 결과와 raw pipeline을 병행 비교한다.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];

export async function GET() {
  const g = await requireRole("owner", "admin");
  if (!g.ok) return g.response;

  const meta = await getOfflineMeta();
  if (!meta.monthYm) return NextResponse.json({ error: "monthYm 없음", meta });

  const ym = meta.monthYm;
  const prevYm = `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;

  // 경로 A: 앱 실제 코드 (unstable_cache 경유)
  const appResult = await getOfflineMonth(ym, prevYm, OFFLINE_DIVISIONS);

  // 경로 B: 캐시/queries 미사용 raw fetch — 이 함수 안에서 완결
  const sb = createServiceClient();
  const cols = "division,cat,brand,store,sales,ym";
  const rawRows: { division: string; cat: string; brand: string; sales: number; p: string }[] = [];
  let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb.from("sales_offline_month").select(cols).in("ym", [ym, prevYm])
      .order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: `raw fetch: ${error.message}` });
    const rows = data ?? [];
    for (const r of rows) rawRows.push({ ...r, p: r.ym } as { division: string; cat: string; brand: string; sales: number; p: string });
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  const rawFiltered = rawRows.filter((r) => OFFLINE_DIVISIONS.includes(r.division) && !isOthersBrand(r.brand));
  const rawDiv = new Map<string, number>();
  const rawFash = new Map<string, number>();
  for (const r of rawFiltered) {
    if (r.p !== ym) continue;
    rawDiv.set(r.division, (rawDiv.get(r.division) ?? 0) + Number(r.sales || 0));
    if (r.division === "패션") rawFash.set(r.cat, (rawFash.get(r.cat) ?? 0) + Number(r.sales || 0));
  }

  return NextResponse.json({
    meta: { ym, prevYm, throughYm: meta.cumThroughYm, cumYear: meta.cumYear },
    appResult: {
      totalRows: rawRows.length,          // 참고: raw로 몇 행이었는지
      total: appResult.total,
      prevTotal: appResult.prevTotal,
      divisionsCount: appResult.divisions.length,
      divisions: appResult.divisions.map((d) => ({ division: d.division, s: d.s })),
      fashionCatsCount: appResult.fashionCats.length,
      fashionCats: appResult.fashionCats.map((c) => ({ cat: c.cat, s: c.s })),
      brandsCount: appResult.brands.length,
      storesCount: appResult.stores.length,
      detailBrandsCount: appResult.detailBrands.length,
    },
    raw: {
      totalRows: rawRows.length,
      filteredCount: rawFiltered.length,
      divisionsCount: rawDiv.size,
      divisions: [...rawDiv.entries()].map(([d, s]) => ({ division: d, s })).sort((a, b) => b.s - a.s),
      fashionCatsCount: rawFash.size,
      fashionCats: [...rawFash.entries()].map(([c, s]) => ({ cat: c, s })).sort((a, b) => b.s - a.s),
    },
  });
}
