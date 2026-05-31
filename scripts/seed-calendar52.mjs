 
// src/data/calendar52.json을 calendar52_weeks 테이블에 시드/리셋.
// 모든 organization에 동일 48주 upsert.
//
// 사용:
//   node scripts/seed-calendar52.mjs            # 변경 없는 행은 그대로 (upsert)
//   node scripts/seed-calendar52.mjs --replace  # 해당 조직의 기존 행을 모두 지우고 재삽입
//
// 환경: .env.local에서 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 자동 로드

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// .env.local 직접 파싱 (dotenv 의존 회피)
function loadEnv() {
  try {
    const txt = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 (.env.local)");
  process.exit(1);
}

const REPLACE = process.argv.includes("--replace");

async function main() {
  const data = JSON.parse(readFileSync(resolve(ROOT, "src/data/calendar52.json"), "utf8"));
  const records = data.records;
  console.log(`✓ ${records.length}주 로드`);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: orgs, error: orgErr } = await admin.from("organizations").select("id, name");
  if (orgErr || !orgs || orgs.length === 0) {
    console.error("organization 없음:", orgErr?.message);
    process.exit(1);
  }
  console.log(`✓ ${orgs.length}개 조직 발견`);

  for (const org of orgs) {
    if (REPLACE) {
      const { error: delErr } = await admin
        .from("calendar52_weeks")
        .delete()
        .eq("organization_id", org.id);
      if (delErr) {
        console.error(`× ${org.name} 기존 행 삭제 실패:`, delErr.message);
        continue;
      }
    }
    const rows = records.map((r) => ({
      organization_id: org.id,
      week_index: r.index,
      month: r.month,
      season: r.season,
      month_kw: r.monthKw ?? "",
      week_no: String(r.weekNo ?? ""),
      concept: r.concept ?? "",
      grade: r.grade ?? "",
      intensity: r.intensity ?? "mid",
      others: r.others ?? [],
      ext_events: r.extEvents ?? [],
      popups: r.popups ?? [],
      item: r.item ?? "",
      hotsauce: r.hotsauce ?? "",
      best_cat: r.bestCat ?? "",
    }));
    const { error } = await admin
      .from("calendar52_weeks")
      .upsert(rows, { onConflict: "organization_id,week_index" });
    if (error) {
      console.error(`× ${org.name} upsert 실패:`, error.message);
    } else {
      console.log(`  ✓ ${org.name} (${org.id}) — ${rows.length}주 upsert`);
    }
  }
  console.log("✓ 완료");
}

main().catch((e) => { console.error(e); process.exit(1); });
