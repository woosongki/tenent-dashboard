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

type SB = ReturnType<typeof createServiceClient>;

/**
 * 브랜드별·지표별 최신값 맵. 이력 전체를 페이지네이션으로 읽어(1000행 상한 회피)
 * checked_on desc → created_at desc 순으로 첫 등장(=최신)만 채택한다.
 */
async function fetchLatestMetrics(sb: SB): Promise<Map<string, Record<string, number | null>>> {
  const latest = new Map<string, Record<string, number | null>>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("bcd_metric_values")
      .select("brand_id, metric_code, value, checked_on, created_at")
      .order("checked_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`bcd loadPool(metrics): ${error.message}`);
    const batch = (data ?? []) as { brand_id: string; metric_code: string; value: number | null }[];
    for (const row of batch) {
      const bucket = latest.get(row.brand_id) ?? {};
      if (!(row.metric_code in bucket)) bucket[row.metric_code] = row.value;
      latest.set(row.brand_id, bucket);
    }
    if (batch.length < PAGE) break;
  }
  return latest;
}

/**
 * 활성 브랜드 + 브랜드별 최신 지표값 + 유효 flag를 채점 입력(BrandInput[])으로 조립한다.
 * brands: 화면 표기용(브랜드명·카테고리) 원본도 함께 반환.
 */
export async function loadPool(): Promise<{ pool: BrandInput[]; brands: BrandRow[] }> {
  const sb = createServiceClient();

  // 세 쿼리를 병렬로 — 순차 왕복이 탭 지연의 주원인이었다.
  const today = new Date().toISOString().slice(0, 10);
  const [brandsRes, latestByBrand, flagRes] = await Promise.all([
    sb.from("bcd_brands")
      .select("id, name, category_major, category_minor, online_applicable, scope_status")
      .eq("scope_status", "active")
      .order("name", { ascending: true }),
    fetchLatestMetrics(sb),
    sb.from("bcd_flags")
      .select("brand_id, flag_type, adjustment, valid_until")
      .or(`valid_until.is.null,valid_until.gte.${today}`),
  ]);
  if (brandsRes.error) throw new Error(`bcd loadPool(brands): ${brandsRes.error.message}`);
  const brandRows = (brandsRes.data ?? []) as BrandRow[];

  const flagByBrand = new Map(
    ((flagRes.data ?? []) as { brand_id: string; flag_type: string; adjustment: number | null }[]).map((f) => [
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
