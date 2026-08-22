/**
 * POST /api/bcd/score/preview  (owner/admin)
 *
 * 편집 중인 기준(ruleset)을 저장하기 전에, 전체 활성 브랜드에 적용했을 때
 * 등급이 어떻게 바뀌는지 미리 계산한다 (PRD 10.1절 "저장 전 전수 재계산 미리보기 필수").
 *
 * 요청: { ruleset: Ruleset }  — 아직 저장되지 않은 편집본
 * 응답: { valid, sum, totalBrands, changedCount, changed, gradeCounts }
 *
 * 채점은 lib/bcd/score.ts의 scorePool/validateRuleset/diffGrades만 사용 — 로직 복제 금지.
 * pool 조립은 lib/bcd/data.ts로 페이지와 단일화.
 */
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { scorePool, validateRuleset, diffGrades, type Ruleset } from "@/lib/bcd/score";
import { getActiveRuleset, loadPool } from "@/lib/bcd/data";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: NextRequest) {
  const g = await requireRole("owner", "admin");
  if (!g.ok) return g.response;

  const { ruleset } = (await req.json().catch(() => ({}))) as { ruleset?: Ruleset };
  if (!ruleset) return Response.json({ error: "ruleset이 필요합니다." }, { status: 400 });

  const valid = validateRuleset(ruleset);
  if (!valid.ok) {
    return Response.json({ valid: false, message: valid.message }, { status: 400 });
  }

  const [{ pool, brands }, activeRuleset] = await Promise.all([loadPool(), getActiveRuleset()]);

  const before = activeRuleset ? scorePool(pool, activeRuleset) : [];
  const after = scorePool(pool, ruleset);

  const nameById = new Map(brands.map((b) => [b.id, b.name]));
  const changed = diffGrades(before, after).map((c) => ({
    ...c,
    name: nameById.get(c.brandId) ?? c.brandId,
  }));

  const gradeCounts = after.reduce<Record<string, number>>((acc, r) => {
    acc[r.grade] = (acc[r.grade] ?? 0) + 1;
    return acc;
  }, {});

  return Response.json({
    valid: true,
    sum: valid.sum,
    totalBrands: pool.length,
    changedCount: changed.length,
    changed,
    gradeCounts,
  });
}
