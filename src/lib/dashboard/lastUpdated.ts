import { createClient } from "@/lib/supabase/server";

/**
 * 지정 테이블에서 가장 최근 업데이트 시점을 반환.
 * `updated_at`이 없으면 `created_at`을 fallback으로 사용.
 * 결과 없거나 오류 시 null 반환 (UI에서 빈값 처리).
 */
export async function getLastUpdated(
  table: "goals" | "attraction_status" | "vendor_fnb",
  column: "updated_at" | "created_at" = "updated_at",
): Promise<Date | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const v = (data as Record<string, string | null>)[column];
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

/** 여러 테이블 중 가장 최근 시각을 반환 (대시보드용). */
export async function getLastUpdatedMax(
  tables: Array<Parameters<typeof getLastUpdated>[0]>,
): Promise<Date | null> {
  const dates = await Promise.all(tables.map((t) => getLastUpdated(t)));
  const valid = dates.filter((d): d is Date => d !== null).map((d) => d.getTime());
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid));
}
