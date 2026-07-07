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
