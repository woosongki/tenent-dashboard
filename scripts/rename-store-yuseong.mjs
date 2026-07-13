// 일회성: 매출 테이블의 "NC대전 유성점" → "대전유성점" 리네임.
// 원인: ERP 매출비교 시트 표기(NC대전 유성점) ≠ 평당 시트 표기(대전유성점) →
// (지점|복종|브랜드) join 실패로 당월 dpp매출/면적이 0으로 표시됨.
// ingest.ts 정규화 커밋 이후 기존 DB row도 동일 규칙으로 정렬.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const OLD = "NC대전 유성점";
const NEW = "대전유성점";
const TABLES = ["sales_offline_month", "sales_offline_cum", "sales_online_monthly", "sales_online_cum"];

for (const t of TABLES) {
  const { count: before } = await sb.from(t).select("id", { count: "exact", head: true }).eq("store", OLD);
  const { error } = await sb.from(t).update({ store: NEW }).eq("store", OLD);
  if (error) { console.error(`${t}: ${error.message}`); continue; }
  const { count: after } = await sb.from(t).select("id", { count: "exact", head: true }).eq("store", NEW);
  console.log(`${t}: ${OLD} rows before=${before ?? "?"} · ${NEW} rows after=${after ?? "?"}`);
}
