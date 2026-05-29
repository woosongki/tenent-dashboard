#!/usr/bin/env node
/**
 * 세터(SATUR) 전국 47개 매장을 카카오 키워드 검색으로 좌표 수집
 * 출력: src/data/satur.ts
 * 실행: node scripts/fetch-satur-stores.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

(function loadEnv() {
  try {
    const txt = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
})();

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
if (!KAKAO_KEY) {
  console.error("❌ KAKAO_REST_API_KEY 미설정");
  process.exit(1);
}

const HEADERS = { Authorization: `KakaoAK ${KAKAO_KEY}` };
const SLEEP_MS = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 사용자 제공 47개 매장명
const STORE_NAMES = [
  "세터 더현대서울점",
  "세터 롯데몰김포공항점",
  "세터 롯데백화점 부산본점",
  "세터 롯데백화점광복점",
  "세터 롯데백화점노원점",
  "세터 롯데백화점대전점",
  "세터 롯데백화점인천점",
  "세터 롯데백화점잠실점",
  "세터 롯데백화점전주점",
  "세터 롯데백화점창원점",
  "세터 롯데아울렛서울역점",
  "세터 롯데아울렛이시아폴리스점",
  "세터 롯데프리미엄아울렛기흥점",
  "세터 롯데프리미엄아울렛김해점",
  "세터 롯데프리미엄아울렛동부산점",
  "세터 스타필드고양점",
  "세터 스타필드수원점",
  "세터 스타필드하남",
  "세터 신라면세점서울점",
  "세터 신세계백화점광주점",
  "세터 신세계백화점대구점",
  "세터 신세계백화점대전점",
  "세터 신세계백화점센텀시티점",
  "세터 신세계사이먼시흥프리미엄아울렛",
  "세터 신세계프리미엄아울렛여주점",
  "세터 신세계프리미엄아울렛파주점",
  "세터 신제주점",
  "세터 아이파크몰 용산점",
  "세터 아카이브 명동점",
  "세터 잠실롯데월드몰점",
  "세터 커넥트현대부산점",
  "세터 커넥트현대청주점",
  "세터 커먼제주",
  "세터 타임빌라스수원점",
  "세터 한남점",
  "세터 현대백화점 중동점 WEST",
  "세터 현대백화점신촌점",
  "세터 현대백화점울산점",
  "세터 현대백화점천호점",
  "세터 현대백화점판교점",
  "세터 현대프리미엄아울렛대전점",
  "세터 현대프리미엄아울렛송도점",
  "세터하우스 광장마켓점",
  "세터하우스 도산점",
  "세터하우스 북촌점",
  "세터하우스 서울숲점",
  "SATUR HOUSE",
];

async function search(query) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  return data.documents ?? [];
}

async function main() {
  const results = [];
  const failed = [];

  for (let i = 0; i < STORE_NAMES.length; i++) {
    const name = STORE_NAMES[i];
    process.stdout.write(`[${i + 1}/${STORE_NAMES.length}] ${name} ... `);

    const docs = await search(name);
    if (!docs || docs.length === 0) {
      console.log("❌ 미발견");
      failed.push(name);
      await sleep(SLEEP_MS);
      continue;
    }

    // 첫 결과 사용 — 이름이 구체적이라 보통 정확
    const top = docs[0];
    results.push({
      id: top.id,
      name,
      addr: top.road_address_name || top.address_name,
      lat: Number(top.y),
      lng: Number(top.x),
    });
    console.log(`✅ ${top.road_address_name || top.address_name}`);
    await sleep(SLEEP_MS);
  }

  // 출력
  const out = `// 세터(SATUR) 전국 매장 위치 데이터
// 수집: Kakao Local API (scripts/fetch-satur-stores.mjs)
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${results.length}개 매장 (입력 ${STORE_NAMES.length}개 중)

import type { ChainStore } from "./artbox";

export const SATUR_STORES: ChainStore[] = ${JSON.stringify(results, null, 2)};
`;
  const outPath = path.resolve(ROOT, "src/data/satur.ts");
  writeFileSync(outPath, out);
  console.log(`\n✅ ${results.length}개 매장 저장: ${outPath}`);
  if (failed.length > 0) {
    console.log(`\n⚠ 미발견 ${failed.length}개:`);
    failed.forEach((n) => console.log(`  - ${n}`));
  }
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
