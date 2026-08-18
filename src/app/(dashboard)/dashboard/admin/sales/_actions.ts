"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type SalesTable =
  | "sales_offline_month"
  | "sales_offline_cum"
  | "sales_online_monthly"
  | "sales_online_cum";

type Row = Record<string, string | number>;
type Result = { ok: true; count: number } | { ok: false; error: string };

const ALLOWED: ReadonlySet<SalesTable> = new Set([
  "sales_offline_month",
  "sales_offline_cum",
  "sales_online_monthly",
  "sales_online_cum",
]);

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m || (m.role !== "owner" && m.role !== "admin")) {
    throw new Error("관리자 권한이 필요합니다.");
  }
}

/**
 * 매출 팩트 테이블 청크 적재. `reset=true` 인 첫 호출에서 테이블 전체 삭제 후 삽입.
 *
 * Why 서버 액션: 팩트 테이블 RLS가 service_role만 쓰기 허용으로 하드닝됨.
 * 브라우저의 anon/authenticated 세션으로는 INSERT가 RLS로 거부되므로,
 * 관리자 게이트를 재검증한 뒤 service role 클라이언트로 우회한다.
 */
export async function commitSalesChunk(
  table: SalesTable,
  rows: Row[],
  opts: { reset: boolean },
): Promise<Result> {
  if (!ALLOWED.has(table)) return { ok: false, error: `허용되지 않은 테이블: ${table}` };
  await requireAdmin();
  // 방어선: reset=true + rows 0행 조합은 테이블만 비우는 사일런트 실패 경로. 클라이언트가 파싱 실패/0행을 잘못 확정 보낸 경우에도 서버에서 거부해 데이터 손실을 막는다.
  if (opts.reset && rows.length === 0) {
    return { ok: false, error: "0행으로는 테이블을 교체할 수 없습니다 (안전 가드). 파일 파싱 결과를 확인하세요." };
  }
  const supabase = createServiceClient();

  if (opts.reset) {
    const { error: delErr } = await supabase.from(table).delete().neq("id", -1);
    if (delErr) return { ok: false, error: `삭제 실패: ${delErr.message}` };
  }
  if (rows.length === 0) return { ok: true, count: 0 };
  const { error } = await supabase.from(table).insert(rows);
  if (error) return { ok: false, error: `적재 실패: ${error.message}` };
  return { ok: true, count: rows.length };
}

/**
 * 오프라인 월별 이력(sales_offline_monthly_hist) 청크 적재.
 * 요구사항 C: 파일에 담긴 연도만 삭제 후 재삽입 — 그 외 과거 연도는 보존.
 * `resetYears` 첫 호출에만 값 전달, 이후 청크는 빈 배열로 인서트만.
 */
export async function commitOfflineHistChunk(
  rows: Row[],
  opts: { resetYears: string[] },
): Promise<Result> {
  await requireAdmin();
  if (opts.resetYears.length > 0 && rows.length === 0) {
    return { ok: false, error: "0행으로는 연도를 교체할 수 없습니다 (안전 가드). 파싱 결과를 확인하세요." };
  }
  const supabase = createServiceClient();
  if (opts.resetYears.length > 0) {
    const { error: delErr } = await supabase
      .from("sales_offline_monthly_hist")
      .delete()
      .in("year", opts.resetYears);
    if (delErr) return { ok: false, error: `삭제 실패: ${delErr.message}` };
  }
  if (rows.length === 0) return { ok: true, count: 0 };
  const { error } = await supabase.from("sales_offline_monthly_hist").insert(rows);
  if (error) return { ok: false, error: `적재 실패: ${error.message}` };
  return { ok: true, count: rows.length };
}
