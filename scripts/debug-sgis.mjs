/* eslint-disable no-console */
/**
 * SGIS API 진단 — 시도/시군구 코드 확인 + year 가용성 체크.
 * 사용: node scripts/debug-sgis.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    const txt = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv();

const BASE = "https://sgisapi.kostat.go.kr/OpenAPI3";
const CK = process.env.SGIS_CONSUMER_KEY;
const CS = process.env.SGIS_CONSUMER_SECRET;

async function getToken() {
  const url = `${BASE}/auth/authentication.json?consumer_key=${CK}&consumer_secret=${CS}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.errCd !== 0) throw new Error(`토큰 실패: ${j.errMsg}`);
  console.log("✓ 토큰 발급 OK");
  return j.result.accessToken;
}

async function call(token, path, params) {
  const sp = new URLSearchParams({ accessToken: token, ...params });
  const url = `${BASE}${path}?${sp}`;
  const r = await fetch(url);
  const j = await r.json();
  return { url, errCd: j.errCd, errMsg: j.errMsg, result: j.result };
}

async function main() {
  if (!CK || !CS) { console.error("SGIS 키 미설정"); process.exit(1); }
  const token = await getToken();

  // 1) 시도 17개 (cd 없이 호출)
  console.log("\n[1] 전국 시도 (cd 없이 stage.json):");
  const sido = await call(token, "/addr/stage.json", {});
  if (sido.errCd !== 0) {
    console.error(`× stage 실패 (${sido.errCd}): ${sido.errMsg}`);
  } else {
    for (const r of sido.result) console.log(`  ${r.cd}  ${r.addr_name}`);
  }

  // 2) 대전 (cd=30) 시군구 찾기 — 사용자 lawdCd=30200이 SGIS와 일치하는지
  console.log("\n[2] 대전 시군구 (cd=30):");
  const daejeon = await call(token, "/addr/stage.json", { cd: "30" });
  if (daejeon.errCd !== 0) {
    console.error(`× cd=30 실패 (${daejeon.errCd}): ${daejeon.errMsg}`);
    console.log("  → SGIS는 시도 코드 체계가 다를 수 있습니다. 위의 [1] 결과에서 대전을 찾으세요.");
  } else {
    for (const r of daejeon.result) console.log(`  ${r.cd}  ${r.addr_name}`);
  }

  // 3) 강남구 (cd=11680) 시군구 인구 — year 가용성 체크
  console.log("\n[3] 강남구 (11680) 인구 — year 가용성:");
  for (const year of ["2023", "2022", "2021", "2020", "2019"]) {
    const pop = await call(token, "/stats/searchpopulation.json", { year, adm_cd: "11680", low_search: "0" });
    const ok = pop.errCd === 0;
    const ppltn = ok ? pop.result?.[0]?.tot_ppltn : "-";
    console.log(`  year=${year}  ${ok ? "✓" : "×"}  ${ok ? `인구 ${ppltn}` : pop.errMsg}`);
    if (ok) {
      console.log(`  → 이 year를 SGIS_STATS_YEAR로 사용하세요.`);
      break;
    }
  }

  // 4) 유성구 (cd=30200) 인구 직접 시도 (다양한 year)
  console.log("\n[4] 유성구 (30200) 인구 — 다양한 year:");
  for (const year of ["2023", "2022", "2021", "2020"]) {
    const pop = await call(token, "/stats/searchpopulation.json", { year, adm_cd: "30200", low_search: "0" });
    const ok = pop.errCd === 0;
    console.log(`  year=${year}  ${ok ? "✓ 인구 " + pop.result?.[0]?.tot_ppltn : "× " + pop.errMsg}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
