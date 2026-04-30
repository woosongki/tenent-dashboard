#!/usr/bin/env node
/**
 * 이랜드리테일 점포 마스터 지오코딩 스크립트
 *
 * 입력:  data/stores/stores-raw.json
 * 출력:  data/stores/stores.json (위경도 + 법정동코드 + 도로명/지번 보강)
 *
 * 사전조건:
 *   - Node.js 18+
 *   - 환경변수 KAKAO_REST_API_KEY (https://developers.kakao.com 에서 발급)
 *
 * 실행:
 *   KAKAO_REST_API_KEY=xxxx node scripts/geocode-stores.mjs
 *   (Windows PowerShell: $env:KAKAO_REST_API_KEY="xxxx"; node scripts/geocode-stores.mjs)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_PATH = path.join(ROOT, "data/stores/stores-raw.json");
const OUT_PATH = path.join(ROOT, "data/stores/stores.json");

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
if (!KAKAO_KEY) {
  console.error("❌ KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.");
  console.error("   https://developers.kakao.com 에서 REST API 키를 발급받아 설정하세요.");
  process.exit(1);
}

const KAKAO_HEADERS = { Authorization: `KakaoAK ${KAKAO_KEY}` };
const SLEEP_MS = 80; // Kakao 분당 한도(개발 30 req/s) 보호용

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 카카오 주소 검색 API
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide#address-coord
 * 도로명/지번 둘 다 매칭. 첫 번째 결과를 사용.
 */
async function geocode(address) {
  const url =
    "https://dapi.kakao.com/v2/local/search/address.json?" +
    new URLSearchParams({ query: address, size: "1" });

  const res = await fetch(url, { headers: KAKAO_HEADERS });
  if (!res.ok) {
    throw new Error(`Kakao API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const doc = json.documents?.[0];
  if (!doc) return null;

  const addr = doc.address || doc.road_address;
  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    // 행정 코드 10자리 = 법정동 코드. 앞 5자리가 lawd_cd (시군구)
    bcode: addr?.b_code ?? null,
    lawdCd: addr?.b_code ? addr.b_code.slice(0, 5) : null,
    region1: addr?.region_1depth_name ?? null,
    region2: addr?.region_2depth_name ?? null,
    region3: addr?.region_3depth_name ?? null,
    roadAddress: doc.road_address?.address_name ?? null,
    jibunAddress: doc.address?.address_name ?? null,
  };
}

/**
 * 키워드 검색 fallback (시군구 동 단위 주소가 모호할 때)
 */
async function searchKeyword(keyword) {
  const url =
    "https://dapi.kakao.com/v2/local/search/keyword.json?" +
    new URLSearchParams({ query: keyword, size: "1" });

  const res = await fetch(url, { headers: KAKAO_HEADERS });
  if (!res.ok) return null;
  const json = await res.json();
  const doc = json.documents?.[0];
  if (!doc) return null;

  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    bcode: null,
    lawdCd: null,
    region1: null,
    region2: null,
    region3: null,
    roadAddress: doc.road_address_name ?? null,
    jibunAddress: doc.address_name ?? null,
    placeName: doc.place_name ?? null,
  };
}

/**
 * 좌표 → 법정동 코드 보강 (keyword 검색에는 b_code가 없음)
 */
async function coord2region(lat, lng) {
  const url =
    "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?" +
    new URLSearchParams({ x: String(lng), y: String(lat) });

  const res = await fetch(url, { headers: KAKAO_HEADERS });
  if (!res.ok) return null;
  const json = await res.json();
  const beob = json.documents?.find((d) => d.region_type === "B");
  if (!beob) return null;
  return {
    bcode: beob.code,
    lawdCd: beob.code.slice(0, 5),
    region1: beob.region_1depth_name,
    region2: beob.region_2depth_name,
    region3: beob.region_3depth_name,
  };
}

async function main() {
  const raw = JSON.parse(await fs.readFile(RAW_PATH, "utf8"));
  const out = { ...raw, geocodedAt: new Date().toISOString().slice(0, 10), stores: [] };

  let success = 0;
  let failed = 0;
  const failures = [];

  for (const store of raw.stores) {
    process.stdout.write(`[${store.brand} ${store.name}] `);

    let geo = null;
    // 1차: 주소 검색
    try {
      geo = await geocode(store.address);
    } catch (e) {
      console.error(`⚠ 주소검색 오류 → ${e.message}`);
    }
    await sleep(SLEEP_MS);

    // 2차 fallback: "{브랜드} {매장명}" 키워드 검색
    if (!geo) {
      const kw = `${store.brand} ${store.name}`;
      try {
        const kwRes = await searchKeyword(kw);
        if (kwRes) {
          geo = kwRes;
          await sleep(SLEEP_MS);
          const region = await coord2region(geo.lat, geo.lng);
          if (region) Object.assign(geo, region);
          await sleep(SLEEP_MS);
        }
      } catch (e) {
        console.error(`⚠ 키워드검색 오류 → ${e.message}`);
      }
    }

    if (geo) {
      out.stores.push({ ...store, ...geo, geocoded: true });
      console.log(`✓ ${geo.lat?.toFixed(5)}, ${geo.lng?.toFixed(5)} (${geo.lawdCd ?? "법정동코드없음"})`);
      success += 1;
    } else {
      out.stores.push({ ...store, geocoded: false });
      console.log(`✗ 실패`);
      failed += 1;
      failures.push(`${store.brand} ${store.name} - ${store.address}`);
    }
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${success} / 실패: ${failed} / 총 ${raw.stores.length}건`);
  console.log(`출력: ${path.relative(ROOT, OUT_PATH)}`);
  if (failures.length) {
    console.log(`\n실패 목록:`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
