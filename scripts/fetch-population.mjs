 
/**
 * 행정안전부_행정동_성별 연령별 주민등록 인구현황 (공공데이터포털 15097972)
 * → 41개 점포 좌표 기준 시군구·행정동 인구 + 연령 10단위 + 성별 분포를
 *    src/data/population.json 으로 저장.
 *
 * 사용:
 *   node scripts/fetch-population.mjs            # 전체
 *   node scripts/fetch-population.mjs --uuid b1817ce4-...  # 다른 월 데이터
 *
 * 환경 (.env.local):
 *   DATA_GO_KR_POP_KEY=발급받은_Encoding_인증키
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── .env.local 로드 ────────────────────────────────────────
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

const KEY = process.env.DATA_GO_KR_POP_KEY;
if (!KEY) {
  console.error("DATA_GO_KR_POP_KEY 미설정 (.env.local 확인)");
  process.exit(1);
}

// ── 데이터 UUID (uddi) ─────────────────────────────────────
// ⚠ odcloud 파일데이터는 월마다 uddi가 바뀐다. 0건이 나오면 uddi가 낡은 것 →
//   포털(15097972) Swagger에서 'Try it out → Execute' 후 Request URL의
//   uddi:XXXX 값을 확인해 아래 기본값을 교체하거나 --uuid 로 넘길 것.
// 최신 확인: 2026-07 (포털 Swagger 기준)
const uuidArgIdx = process.argv.indexOf("--uuid");
const DATA_UUID = uuidArgIdx > 0
  ? process.argv[uuidArgIdx + 1]
  : "59bf4bd0-a476-4acf-a416-d007b32860a1";

const ENDPOINT = `https://api.odcloud.kr/api/15097972/v1/uddi:${DATA_UUID}`;

// ── 전체 데이터 fetch (페이징) ─────────────────────────────
async function fetchAllPopulation() {
  const all = [];
  let page = 1;
  // ⚠ perPage가 너무 크면(예: 10000) odcloud가 빈 상태봉투({code:0,msg:"정상"})를
  //   반환하는 경우가 있어 1000으로 페이징. returnType은 붙이지 않는다(붙이면 빈 응답).
  const perPage = 1000;
  for (;;) {
    // serviceKey는 URLSearchParams가 이중인코딩할 수 있어 URL에 직접 붙임
    const qs = `page=${page}&perPage=${perPage}`;
    const url = `${ENDPOINT}?${qs}&serviceKey=${KEY}`;

    if (page === 1) console.log(`  요청: ${ENDPOINT}?${qs}&serviceKey=***`);

    const res = await fetch(url);
    const txt = await res.text();

    if (!res.ok) {
      console.error(`× HTTP ${res.status}`);
      console.error(`  URL  : ${url.replace(KEY, "***")}`);
      console.error(`  본문 : ${txt.slice(0, 500)}`);
      throw new Error(`API ${res.status}`);
    }

    let json;
    try { json = JSON.parse(txt); }
    catch {
      console.error("× JSON 파싱 실패. 응답 본문:");
      console.error(txt.slice(0, 800));
      throw new Error("JSON 파싱 실패");
    }

    // 첫 페이지에서 응답 구조 확인 로그
    if (page === 1) {
      console.log("  응답 키:", Object.keys(json).join(", "));
      if (json.totalCount === undefined && json.data === undefined) {
        console.log("  ⚠ 예상과 다른 응답:", JSON.stringify(json).slice(0, 400));
      }
    }

    const data = json.data ?? [];
    all.push(...data);
    console.log(`  page ${page} · ${data.length}건 (누적 ${all.length} / 전체 ${json.totalCount ?? "?"})`);
    if (data.length === 0) break;
    if (json.totalCount && all.length >= json.totalCount) break;
    page++;
    if (page > 30) break; // safety
  }
  return all;
}

// ── 시도명 정규화 (카카오 단축형 → 행안부 정식) ───────────
const SIDO_NORMALIZE = {
  "서울": "서울특별시", "서울특별시": "서울특별시",
  "부산": "부산광역시", "부산광역시": "부산광역시",
  "대구": "대구광역시", "대구광역시": "대구광역시",
  "인천": "인천광역시", "인천광역시": "인천광역시",
  "광주": "광주광역시", "광주광역시": "광주광역시",
  "대전": "대전광역시", "대전광역시": "대전광역시",
  "울산": "울산광역시", "울산광역시": "울산광역시",
  "세종": "세종특별자치시", "세종특별자치시": "세종특별자치시",
  "경기": "경기도", "경기도": "경기도",
  "강원": "강원특별자치도", "강원도": "강원특별자치도",
  "강원특별자치도": "강원특별자치도",
  "충북": "충청북도", "충청북도": "충청북도",
  "충남": "충청남도", "충청남도": "충청남도",
  "전북": "전북특별자치도", "전라북도": "전북특별자치도",
  "전북특별자치도": "전북특별자치도",
  "전남": "전라남도", "전라남도": "전라남도",
  "경북": "경상북도", "경상북도": "경상북도",
  "경남": "경상남도", "경상남도": "경상남도",
  "제주": "제주특별자치도", "제주도": "제주특별자치도",
  "제주특별자치도": "제주특별자치도",
};

function normalizeSido(name) {
  if (!name) return null;
  return SIDO_NORMALIZE[name.trim()] ?? name;
}

// ── 점포 로딩 ─────────────────────────────────────────────
const storesFile = JSON.parse(readFileSync(resolve(ROOT, "data/stores/stores.json"), "utf8"));
const stores = storesFile.stores.filter((s) => s.geocoded);
console.log(`✓ ${stores.length}개 점포 (지오코딩 완료)`);
console.log(`✓ 데이터셋: uddi:${DATA_UUID}\n`);

// ── 인구 데이터 행 타입 ────────────────────────────────────
// 응답 필드(2026-07 확인): 행정기관코드, 시도명, 시군구명, 읍면동명, 기준연월,
//          계, 남자, 여자, "0세남자", ..., "109세여자", "110세이상 남자"/"110세이상 여자"
//   ※ "만" 접두어 없음. 110세는 "110세이상"+공백+"남자/여자".

// 연령 10단위 합산 헬퍼
function sumAgeRange(row, from, to, gender /* "남자"|"여자"|null=둘다 */) {
  let sum = 0;
  for (let age = from; age <= to; age++) {
    if (gender === "남자" || gender === null) sum += Number(row[`${age}세남자`]) || 0;
    if (gender === "여자" || gender === null) sum += Number(row[`${age}세여자`]) || 0;
  }
  return sum;
}

function sumAge110Over(row, gender) {
  let sum = 0;
  if (gender === "남자" || gender === null) sum += Number(row["110세이상 남자"]) || 0;
  if (gender === "여자" || gender === null) sum += Number(row["110세이상 여자"]) || 0;
  return sum;
}

function aggregate(rows) {
  let total = 0, male = 0, female = 0;
  const ageGroups = {
    "0_9":   0, "10_19": 0, "20_29": 0, "30_39": 0,
    "40_49": 0, "50_59": 0, "60_69": 0, "70_over": 0,
  };
  for (const r of rows) {
    total  += Number(r["계"]) || 0;
    male   += Number(r["남자"]) || 0;
    female += Number(r["여자"]) || 0;
    ageGroups["0_9"]   += sumAgeRange(r, 0, 9, null);
    ageGroups["10_19"] += sumAgeRange(r, 10, 19, null);
    ageGroups["20_29"] += sumAgeRange(r, 20, 29, null);
    ageGroups["30_39"] += sumAgeRange(r, 30, 39, null);
    ageGroups["40_49"] += sumAgeRange(r, 40, 49, null);
    ageGroups["50_59"] += sumAgeRange(r, 50, 59, null);
    ageGroups["60_69"] += sumAgeRange(r, 60, 69, null);
    ageGroups["70_over"] += sumAgeRange(r, 70, 109, null) + sumAge110Over(r, null);
  }
  return { total, male, female, ageGroups };
}

// ── 메인 ─────────────────────────────────────────────────
async function main() {
  console.log("📥 전체 인구 데이터 fetch...");
  const allRows = await fetchAllPopulation();
  console.log(`✓ 행정동 ${allRows.length}건 로드\n`);

  // 기준연월 (첫 행)
  const baseYm = allRows[0]?.["기준연월"] ?? "?";

  const records = [];

  for (const store of stores) {
    const region1Full = normalizeSido(store.region1); // "서울" → "서울특별시"
    const region2 = store.region2; // 시군구 (예: "강남구", "유성구")
    const region3 = store.region3; // 행정동 (예: "역삼동", "봉명동")

    // 시군구 매칭 — 정규화된 시도명 + 시군구명 일치
    const sigunguRows = allRows.filter((r) => {
      return r["시도명"] === region1Full && r["시군구명"] === region2;
    });

    // 행정동(region3) 단일 매칭
    const dongRow = region3
      ? sigunguRows.find((r) => r["읍면동명"] === region3)
      : null;

    const sigunguAgg = aggregate(sigunguRows);
    const dongAgg = dongRow ? aggregate([dongRow]) : null;

    records.push({
      storeId: store.id,
      brand: store.brand,
      name: store.name,
      lat: store.lat,
      lng: store.lng,
      region: { 1: store.region1, 2: region2, 3: region3 },

      sigungu: {
        name: region2,
        dongCount: sigunguRows.length,
        ...sigunguAgg,
      },
      dong: dongRow ? {
        name: region3,
        ...dongAgg,
      } : null,
    });

    const sigPpltn = sigunguAgg.total.toLocaleString();
    const dongPpltn = dongRow ? dongAgg.total.toLocaleString() : "—";
    console.log(`  · ${store.brand} ${store.name} (${region2} ${region3 ?? ""})`);
    console.log(`    시군구 ${sigPpltn}명 / 행정동 ${dongPpltn}명`);
  }

  const out = resolve(ROOT, "src/data/population.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({
    source: "행정안전부_행정동_성별 연령별 주민등록 인구현황 (공공데이터포털 15097972)",
    baseYm,
    uuid: DATA_UUID,
    fetchedAt: new Date().toISOString(),
    count: records.length,
    note: "행정동 단위 데이터를 시군구 합산 + 점포 행정동(region3) 단일로 표시. 좌표 기반 3km 반경은 별도 좌표 변환 필요.",
    records,
  }, null, 2), "utf8");

  console.log(`\n✓ ${records.length}개 점포 → ${out}`);
  console.log(`✓ 기준연월: ${baseYm}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
