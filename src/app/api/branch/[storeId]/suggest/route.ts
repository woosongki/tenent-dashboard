import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { getStoreById } from "@/lib/stores";
import { getCategoryGap } from "@/lib/branch/categoryGap";
import { getNearbyExternalChains } from "@/lib/branch/externalBrands";
import { getResidents, pctOf } from "@/lib/population/residents";
import { suggestExternalBrands } from "@/lib/branch/suggestBrands";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/branch/:storeId/suggest
 *
 * 빈(약한) 카테고리를 채울 외부 시장 브랜드를 Claude로 on-demand 제안.
 * - 평소엔 호출되지 않음 → 비용 0. 사용자가 버튼을 눌러야만 LLM 호출.
 * - owner/admin만 실행(API 비용 보호), 레이트 리밋 적용.
 * - 입력(빈 카테고리·인근 체인)은 서버에서 재계산 → 클라이언트 신뢰 안 함.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const g = await requireRole("owner", "admin");
  if (!g.ok) return g.response;
  const { user } = g;

  const limited = rateLimit(`branch-suggest:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const { storeId } = await ctx.params;
  const store = getStoreById(storeId);
  if (!store) return Response.json({ error: "점포를 찾을 수 없음" }, { status: 404 });

  const categoryGap = await getCategoryGap(storeId, store.name);
  if (!categoryGap || categoryGap.weak.length === 0) {
    return Response.json(
      { error: "상권유형 평균 대비 빈 카테고리가 없어 제안할 대상이 없습니다." },
      { status: 400 },
    );
  }

  const nearbyChains = await getNearbyExternalChains(store.lat, store.lng, 3);

  // 거주인구 요약(있으면) — 연령 skew를 제안 근거로 전달
  const residents = getResidents(storeId);
  let demographics: string | undefined;
  if (residents) {
    const g = residents.sigungu.ageGroups;
    const total = residents.sigungu.total;
    const core = pctOf(g["30_39"] + g["40_49"] + g["50_59"], total);
    const young = pctOf(g["20_29"] + g["30_39"], total);
    const kids = pctOf(g["0_9"] + g["10_19"], total);
    demographics = `${residents.sigungu.name} 총 ${total.toLocaleString()}명 · 30~50대 ${Math.round(core)}% · 20~30대 ${Math.round(young)}% · 10대이하 ${Math.round(kids)}%`;
  }

  try {
    const suggestions = await suggestExternalBrands({
      storeName: store.name,
      brand: store.brand,
      tradeAreaType: categoryGap.tradeAreaType,
      region: `${store.region1} ${store.region2}`,
      weak: categoryGap.weak,
      nearbyChains: nearbyChains.map((c) => ({ label: c.label, cat: c.cat })),
      demographics,
    });
    return Response.json({ suggestions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "제안 실패";
    return Response.json({ error: msg }, { status: 502 });
  }
}
