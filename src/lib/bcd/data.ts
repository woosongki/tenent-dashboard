import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { scorePool, type Ruleset, type BrandInput, type ScoreResult } from "./score";

// BCD(브랜드컨셉등급제) 데이터 로더 — pool 조립·활성 ruleset을 한 곳에서.
// 페이지(서버 채점)와 /api/bcd/score/preview(미리보기)가 동일 조립을 쓰도록 단일화.
// 채점 로직 자체는 lib/bcd/score.ts 하나뿐(설계원칙: 서버 단일 소스).

export interface BrandRow {
  id: string;
  name: string;
  category_major: string;
  category_minor: string;
  online_applicable: boolean;
  scope_status: string;
}

/** 활성 ruleset(정의). 없거나 테이블 미적용이면 null. */
export async function getActiveRuleset(): Promise<Ruleset | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("bcd_rulesets")
    .select("definition")
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data.definition as Ruleset;
}

/**
 * 활성 브랜드 + 브랜드별 최신 지표값 + 유효 flag를 채점 입력(BrandInput[])으로 조립한다.
 * brands: 화면 표기용(브랜드명·카테고리) 원본도 함께 반환.
 */
export async function loadPool(): Promise<{ pool: BrandInput[]; brands: BrandRow[] }> {
  const sb = createServiceClient();

  const { data: brands, error: brandErr } = await sb
    .from("bcd_brands")
    .select("id, name, category_major, category_minor, online_applicable, scope_status")
    .eq("scope_status", "active")
    .order("name", { ascending: true });
  if (brandErr) throw new Error(`bcd loadPool(brands): ${brandErr.message}`);
  const brandRows = (brands ?? []) as BrandRow[];

  const { data: metricRows, error: metricErr } = await sb
    .from("bcd_metric_values")
    .select("brand_id, metric_code, value, checked_on")
    .order("checked_on", { ascending: false });
  if (metricErr) throw new Error(`bcd loadPool(metrics): ${metricErr.message}`);

  // 브랜드별 최신값만 (checked_on desc 정렬이라 첫 등장이 최신)
  const latestByBrand = new Map<string, Record<string, number | null>>();
  for (const row of (metricRows ?? []) as { brand_id: string; metric_code: string; value: number | null }[]) {
    const bucket = latestByBrand.get(row.brand_id) ?? {};
    if (!(row.metric_code in bucket)) bucket[row.metric_code] = row.value;
    latestByBrand.set(row.brand_id, bucket);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: flagRows } = await sb
    .from("bcd_flags")
    .select("brand_id, flag_type, adjustment, valid_until")
    .or(`valid_until.is.null,valid_until.gte.${today}`);
  const flagByBrand = new Map(
    ((flagRows ?? []) as { brand_id: string; flag_type: string; adjustment: number | null }[]).map((f) => [
      f.brand_id,
      { type: f.flag_type as "knockout" | "override", adjustment: f.adjustment ?? undefined },
    ])
  );

  const pool: BrandInput[] = brandRows.map((b) => ({
    id: b.id,
    category_major: b.category_major,
    category_minor: b.category_minor,
    online_applicable: b.online_applicable,
    values: latestByBrand.get(b.id) ?? {},
    flag: flagByBrand.get(b.id) ?? null,
  }));

  return { pool, brands: brandRows };
}

/** 현재 활성 ruleset으로 전 브랜드 채점 + 표기용 원본을 함께 반환. ruleset 없으면 scores=[]. */
export async function loadScored(): Promise<{
  ruleset: Ruleset | null;
  brands: BrandRow[];
  scores: ScoreResult[];
}> {
  const [ruleset, { pool, brands }] = await Promise.all([getActiveRuleset(), loadPool()]);
  const scores = ruleset ? scorePool(pool, ruleset) : [];
  return { ruleset, brands, scores };
}
