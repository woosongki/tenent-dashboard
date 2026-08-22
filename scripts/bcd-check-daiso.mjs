// BCD 카카오 수집 진단 — 다이소 한 건만 실제 호출해 C1·C2·C3를 찍어본다.
// 원격 환경은 외부 API 프록시 403이라 여기서 못 돌린다. 로컬에서 실행:
//   KAKAO_REST_API_KEY=<REST키> node scripts/bcd-check-daiso.mjs
//   (.env.local 에 키가 있으면 아래처럼: node --env-file=.env.local scripts/bcd-check-daiso.mjs)
import fs from "node:fs";

const KEY = process.env.KAKAO_REST_API_KEY;
if (!KEY) { console.error("❌ KAKAO_REST_API_KEY 환경변수가 없습니다. REST API 키(지도 JS 키 아님)를 넣으세요."); process.exit(1); }
console.log("KEY 앞 4자리:", KEY.slice(0, 4) + "…", "(길이", KEY.length + ")");

const BRAND = "다이소";
const norm = (s) => (s || "").replace(/\s+/g, "").toLowerCase();
const matchesAny = (hay, needles) => { const h = norm(hay); return needles.some((n) => n && h.includes(norm(n))); };

// 시드 파일에서 핫플·벤치마크 매칭어 추출(로컬 clone에 존재)
function parseArrays(file, listType) {
  let txt = ""; try { txt = fs.readFileSync(file, "utf8"); } catch { return []; }
  const re = new RegExp(`\\('${listType}','v1\\.0','([^']+)',\\s*array\\[([^\\]]*)\\]`, "g");
  const out = []; let m;
  while ((m = re.exec(txt))) {
    const name = m[1];
    const ks = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
    out.push({ name, match: ks.length ? ks : [name] });
  }
  return out;
}
const hotspots = parseArrays("supabase/bcd_hotspot_seed.sql", "hotspot");
const benchmarks = parseArrays("supabase/bcd_seed.sql", "benchmark");
console.log("핫플 상권:", hotspots.length, "개 · 벤치마크 유통:", benchmarks.length, "개 (시드 파일 기준)");

async function kakaoSearch(q) {
  const docs = [];
  for (let page = 1; page <= 3; page++) {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=15&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
    console.log(`  [page ${page}] HTTP ${res.status}`);
    if (!res.ok) { console.error("  ↳ 오류 응답:", (await res.text()).slice(0, 300)); throw new Error(`kakao ${res.status}`); }
    const data = await res.json();
    docs.push(...(data.documents ?? []));
    if (data.meta?.is_end || page * 15 >= (data.meta?.pageable_count ?? 0)) break;
  }
  return docs;
}

console.log(`\n=== 카카오 키워드 검색: "${BRAND}" ===`);
let docs;
try { docs = await kakaoSearch(BRAND); }
catch (e) { console.error("❌ 검색 실패 —", e.message, "\n→ 401이면 키 종류/권한 문제(REST키인지, 앱 플랫폼 등록됐는지 확인)."); process.exit(1); }

const byId = new Map(docs.map((d) => [d.id, d]));
const places = [...byId.values()];
console.log(`\nC3 (전국 매장 수, 최대 45건 표본) = ${places.length}`);
console.log("샘플 주소 5건:");
places.slice(0, 5).forEach((p) => console.log(`  - ${p.place_name} | ${p.road_address_name || p.address_name}`));

// C2
const hit = new Set();
for (const p of places) for (const h of hotspots) if (matchesAny(`${p.road_address_name} ${p.address_name}`, h.match)) hit.add(h.name);
console.log(`\nC2 (입점 핫플 상권 수) = ${hit.size}`);
console.log("  매칭된 상권:", [...hit].join(", ") || "(없음 — 매칭어가 주소와 안 겹침)");

// C1
const full = benchmarks; // bcd_seed의 10개는 전부 is_full_survey=true
const matchedMalls = full.filter((mall) => places.some((p) => matchesAny(`${p.place_name} ${p.road_address_name} ${p.address_name}`, mall.match)));
console.log(`\nC1 (벤치마크 입점률) = ${full.length ? Math.round(matchedMalls.length / full.length * 100) : 0}%  (${matchedMalls.length}/${full.length})`);
console.log("  매칭된 벤치마크 유통:", matchedMalls.map((m) => m.name).join(", ") || "(없음)");
console.log("\n✅ 진단 끝. C3=0이면 검색결과 없음/키문제, C2=0이면 매칭어 보정 필요, HTTP 401이면 키 종류 문제.");
