#!/usr/bin/env node
/**
 * sales_offline_cum.through_ym 1회성 백필.
 *
 * 배경: 종전엔 누적 개월수를 sales_offline_month의 최신 ym에서 유추 → 당월(예: 7월)이
 * 먼저 적재되면 6월 누적을 7로 나누는 회귀 발생. through_ym(누적 마감월)을 각 행에
 * 저장해 이 결합을 끊었다.
 *
 * 이 스크립트는 기존 누적 행에 through_ym을 채워넣는다. 인자로 마감월(YYYY-MM)을 받고,
 * cur/prev 두 해에 각각 `${year}-${MM}` 을 UPDATE 한다.
 *
 * 사용:
 *   node scripts/backfill-offline-cum-through-ym.mjs 2026-06
 *   # → 2026 행에 '2026-06', 2025 행에 '2025-06' 저장
 *
 * 사전 조건: 스키마에 through_ym 컬럼이 이미 있어야 함. 없으면 Supabase SQL Editor에서:
 *   alter table public.sales_offline_cum add column if not exists through_ym text;
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const throughMonthYm = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(throughMonthYm ?? "")) {
  console.error("❌ 사용법: node scripts/backfill-offline-cum-through-ym.mjs <YYYY-MM>");
  process.exit(1);
}
const mm = throughMonthYm.slice(5, 7);
const curYear = throughMonthYm.slice(0, 4);
const prevYear = String(Number(curYear) - 1);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  // 컬럼 존재 여부 확인 — 없으면 명확한 에러 메시지로 종료
  const probe = await supabase.from("sales_offline_cum").select("through_ym").limit(1);
  if (probe.error) {
    console.error("❌ 컬럼 접근 실패:", probe.error.message);
    console.error("   먼저 Supabase SQL Editor에서:");
    console.error("     alter table public.sales_offline_cum add column if not exists through_ym text;");
    process.exit(1);
  }

  // dry-run 통계
  const [{ count: curCnt }, { count: prevCnt }] = await Promise.all([
    supabase.from("sales_offline_cum").select("id", { count: "exact", head: true }).eq("year", curYear),
    supabase.from("sales_offline_cum").select("id", { count: "exact", head: true }).eq("year", prevYear),
  ]);
  console.log(`📋 대상 행 수: ${curYear}=${curCnt ?? "?"}, ${prevYear}=${prevCnt ?? "?"}`);
  console.log(`✏️  ${curYear} → through_ym = '${curYear}-${mm}', ${prevYear} → '${prevYear}-${mm}'`);

  const updCur = await supabase
    .from("sales_offline_cum")
    .update({ through_ym: `${curYear}-${mm}` })
    .eq("year", curYear)
    .select("id", { count: "exact", head: true });
  if (updCur.error) throw new Error(`${curYear} 업데이트 실패: ${updCur.error.message}`);
  console.log(`✅ ${curYear}: ${updCur.count ?? "?"}행 갱신`);

  const updPrev = await supabase
    .from("sales_offline_cum")
    .update({ through_ym: `${prevYear}-${mm}` })
    .eq("year", prevYear)
    .select("id", { count: "exact", head: true });
  if (updPrev.error) throw new Error(`${prevYear} 업데이트 실패: ${updPrev.error.message}`);
  console.log(`✅ ${prevYear}: ${updPrev.count ?? "?"}행 갱신`);

  console.log("🎉 백필 완료 — 매출분석 페이지 새로고침 시 즉시 반영됩니다.");
}

main().catch((e) => {
  console.error("❌ 실패:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
