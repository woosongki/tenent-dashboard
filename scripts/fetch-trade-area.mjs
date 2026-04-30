#!/usr/bin/env node
/**
 * 이랜드리테일 점포 주변 상권 분석 데이터 수집기
 *
 * 입력:  data/stores/stores.json (지오코딩 완료된 매장 마스터)
 * 출력:  data/trade-area/{storeId}.json (매장별 반경 N미터 상권 분석)
 *        data/trade-area/_index.json (전 매장 요약 인덱스)
 *
 * 데이터 소스: 소상공인시장진흥공단 상가업소정보 OpenAPI
 *   - 엔드포인트: /B553077/api/open/sdsc2/storeListInRadius
 *   - 키: SBIZ_API_KEY (data.go.kr 발급)
 *
 * 실행:
 *   SBIZ_API_KEY=xxxx node scripts/fetch-trade-area.mjs              # 기본 반경 500m
 *   SBIZ_API_KEY=xxxx node scripts/fetch-trade-area.mjs --radius 1000
 *   SBIZ_API_KEY=xxxx node scripts/fetch-trade-area.mjs --only nc-songpa,newcore-gangnam
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STORES_PATH = path.join(ROOT, "data/stores/stores.json");
const OUT_DIR = path.join(ROOT, "data/trade-area");

const SBIZ_KEY = process.env.SBIZ_API_KEY;
if (!SBIZ_KEY) {
  console.error("❌ SBIZ_API_KEY 환경변수가 설정되지 않았습니다.");
  console.error("   https://www.data.go.kr/data/15012005/openapi.do 에서 활용신청 후 키 설정");
  process.exit(1);
}

// CLI 인자 파싱
const args = process.argv.slice(2);
const RADIUS = Number(getArg("--radius") ?? 500);
const ONLY = getArg("--only")?.split(",").map((s) => s.trim());
const SLEEP_MS = 200;

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENDPOINT = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius";

/**
 * 단일 페이지 호출
 */
async function fetchPage({ cx, cy, radius, pageNo, numOfRows = 1000 }) {
  const url =
    ENDPOINT +
    "?" +
    new URLSearchParams({
      serviceKey: SBIZ_KEY,
      radius: String(radius),
      cx: String(cx),
      cy: String(cy),
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      type: "json",
    });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SBIZ API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`JSON parse 실패: ${text.slice(0, 200)}`);
  }
  const body = json.body ?? json.response?.body ?? json;
  const items = body.items ?? body?.items?.item ?? [];
  const totalCount = Number(body.totalCount ?? 0);
  return { items: Array.isArray(items) ? items : [items].filter(Boolean), totalCount };
}

/**
 * 전 페이지 수집 (totalCount까지)
 */
async function fetchAllStores({ cx, cy, radius }) {
  const all = [];
  let pageNo = 1;
  while (true) {
    const { items, totalCount } = await fetchPage({ cx, cy, radius, pageNo });
    all.push(...items);
    if (all.length >= totalCount || items.length === 0) break;
    pageNo += 1;
    await sleep(SLEEP_MS);
    if (pageNo > 50) break; // 안전장치 (5만건)
  }
  return all;
}

/**
 * 업종 분류별 집계
 */
function aggregate(stores) {
  const byL = {}; // 대분류
  const byM = {}; // 중분류
  const byS = {}; // 소분류
  let foodCount = 0;
  let retailCount = 0;
  let lifeServiceCount = 0;
  let medicalCount = 0;
  let educationCount = 0;
  let leisureCount = 0;
  let competitorCount = 0; // 백화점·아울렛·대형마트

  for (const s of stores) {
    const L = s.indsLclsNm ?? s.indsLclsCdNm ?? "(미분류)";
    const M = s.indsMclsNm ?? "(미분류)";
    const S = s.indsSclsNm ?? "(미분류)";

    byL[L] = (byL[L] ?? 0) + 1;
    byM[`${L} > ${M}`] = (byM[`${L} > ${M}`] ?? 0) + 1;
    byS[`${L} > ${M} > ${S}`] = (byS[`${L} > ${M} > ${S}`] ?? 0) + 1;

    if (L === "음식") foodCount++;
    else if (L === "소매") {
      retailCount++;
      // 경쟁 점포: 종합소매·백화점·대형마트
      if (/백화점|대형마트|쇼핑센터|아울렛|복합쇼핑/.test(M + S)) competitorCount++;
    } else if (L === "생활서비스") lifeServiceCount++;
    else if (L === "의료") medicalCount++;
    else if (L === "학문/교육") educationCount++;
    else if (L === "관광/여가/오락") leisureCount++;
  }

  // 비중 계산
  const total = stores.length;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  return {
    total,
    breakdown: {
      food: { count: foodCount, pct: pct(foodCount) },
      retail: { count: retailCount, pct: pct(retailCount) },
      lifeService: { count: lifeServiceCount, pct: pct(lifeServiceCount) },
      medical: { count: medicalCount, pct: pct(medicalCount) },
      education: { count: educationCount, pct: pct(educationCount) },
      leisure: { count: leisureCount, pct: pct(leisureCount) },
    },
    competitorCount,
    topL: Object.entries(byL).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topM: Object.entries(byM).sort((a, b) => b[1] - a[1]).slice(0, 15),
    topS: Object.entries(byS).sort((a, b) => b[1] - a[1]).slice(0, 20),
  };
}

/**
 * 상권 성격 한 줄 라벨
 */
function classifyTradeArea(agg) {
  const { breakdown, total } = agg;
  if (total < 50) return "저밀도 상권";
  if (breakdown.food.pct >= 45) return "음식 중심 상권";
  if (breakdown.education.pct >= 15) return "학세권/교육 상권";
  if (breakdown.medical.pct >= 12) return "의료 인접 상권";
  if (breakdown.retail.pct >= 30) return "소매 중심 상권";
  if (breakdown.leisure.pct >= 10) return "관광/여가 상권";
  return "복합 상권";
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const masterRaw = JSON.parse(await fs.readFile(STORES_PATH, "utf8"));
  const stores = masterRaw.stores.filter((s) => s.geocoded);

  const targets = ONLY ? stores.filter((s) => ONLY.includes(s.id)) : stores;
  console.log(`대상 매장: ${targets.length} / 반경: ${RADIUS}m\n`);

  const index = [];
  let success = 0;
  let failed = 0;

  for (const store of targets) {
    process.stdout.write(`[${store.brand} ${store.name}] `);
    try {
      const items = await fetchAllStores({ cx: store.lng, cy: store.lat, radius: RADIUS });
      const agg = aggregate(items);
      const tradeAreaType = classifyTradeArea(agg);

      const result = {
        storeId: store.id,
        storeName: `${store.brand} ${store.name}`,
        center: { lat: store.lat, lng: store.lng, address: store.address },
        radius: RADIUS,
        fetchedAt: new Date().toISOString(),
        tradeAreaType,
        ...agg,
        // 전체 raw items 는 별도 보관 (용량)
      };

      // 매장별 상세 (rawStores 미저장 — 용량 절약, 집계 결과만 유지)
      const detailPath = path.join(OUT_DIR, `${store.id}.json`);
      await fs.writeFile(detailPath, JSON.stringify(result, null, 2));

      index.push({
        id: store.id,
        brand: store.brand,
        name: store.name,
        lawdCd: store.lawdCd,
        region: `${store.region1} ${store.region2}`,
        radius: RADIUS,
        total: agg.total,
        tradeAreaType,
        foodPct: agg.breakdown.food.pct,
        retailPct: agg.breakdown.retail.pct,
        competitorCount: agg.competitorCount,
      });

      console.log(`✓ ${agg.total}개 점포 (${tradeAreaType})`);
      success++;
    } catch (e) {
      console.log(`✗ ${e.message.slice(0, 100)}`);
      failed++;
    }
    await sleep(SLEEP_MS);
  }

  // 인덱스 저장
  await fs.writeFile(
    path.join(OUT_DIR, "_index.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), radius: RADIUS, count: index.length, stores: index },
      null,
      2,
    ),
  );

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${success} / 실패: ${failed} / 총 ${targets.length}건`);
  console.log(`출력: data/trade-area/{storeId}.json + _index.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
