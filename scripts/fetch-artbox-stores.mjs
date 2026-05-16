#!/usr/bin/env node
/**
 * 아트박스 전국 매장 위치 수집 (Kakao Local API)
 *
 * 출력: src/data/artbox.ts (ARTBOX_STORES 배열 갱신)
 *
 * 사전조건:
 *   - Node.js 18+
 *   - 환경변수 KAKAO_REST_API_KEY (.env.local)
 *
 * 실행:
 *   node scripts/fetch-artbox-stores.mjs
 *
 * 동작:
 *   - 17 시도별로 "아트박스" 키워드 검색 → place_id 기준 dedup
 *   - 카카오는 검색당 최대 45건 → 시도별 분할로 전국 커버
 *   - rate limit 보호: 80ms 슬립 (~12 req/s, 일일 30만건 한도 여유)
 */

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "src/data/artbox.ts");

// .env.local 자동 로드
(function loadEnvLocal() {
  try {
    const txt = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
})();

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
if (!KAKAO_KEY) {
  console.error("❌ KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.");
  console.error("   .env.local 에 'KAKAO_REST_API_KEY=...' 추가 후 다시 실행하세요.");
  process.exit(1);
}

const HEADERS = { Authorization: `KakaoAK ${KAKAO_KEY}` };
const SLEEP_MS = 80;

// 검색 분할용 시도/지역 키워드. 카카오는 단일 쿼리당 최대 45건 제한이므로
// 지역 단위로 쪼개야 전국 ~300개를 빠뜨리지 않고 수집 가능.
const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기 수원", "경기 성남", "경기 안양", "경기 안산", "경기 부천",
  "경기 고양", "경기 용인", "경기 평택", "경기 의정부", "경기 화성",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchKeyword(query, page = 1) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=15`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Kakao ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

/** 아트박스 직영/위탁만 추출. "OO아트박스" 같은 동명이인 점포 제외 */
function isArtbox(place) {
  const name = String(place.place_name || "").trim();
  // 정확히 "아트박스" 이거나 "아트박스 " 로 시작 (지점명 형식)
  return name === "아트박스" || name.startsWith("아트박스 ");
}

async function main() {
  const seen = new Map(); // id -> ChainStore
  let total = 0;

  for (const region of REGIONS) {
    process.stdout.write(`[${region}] `);
    let regionCount = 0;
    for (let page = 1; page <= 3; page++) {
      try {
        const data = await searchKeyword(`${region} 아트박스`, page);
        const docs = data.documents || [];
        for (const d of docs) {
          if (!isArtbox(d)) continue;
          if (seen.has(d.id)) continue;
          seen.set(d.id, {
            id: d.id,
            name: d.place_name,
            addr: d.road_address_name || d.address_name || "",
            lat: parseFloat(d.y),
            lng: parseFloat(d.x),
          });
          regionCount++;
        }
        if (data.meta?.is_end) break;
      } catch (err) {
        console.error(`\n  ⚠️  ${region} p${page} 실패: ${err.message}`);
        break;
      }
      await sleep(SLEEP_MS);
    }
    total = seen.size;
    process.stdout.write(`+${regionCount} (누적 ${total})\n`);
  }

  const stores = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // src/data/artbox.ts 재생성
  const tsContent = `// 아트박스 전국 매장 위치 데이터
// 수집: Kakao Local API (scripts/fetch-artbox-stores.mjs)
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${stores.length}개 매장

export interface ChainStore {
  id: string;
  name: string;
  addr: string;
  lat: number;
  lng: number;
}

export const ARTBOX_STORES: ChainStore[] = ${JSON.stringify(stores, null, 2)};
`;
  await fs.writeFile(OUT_PATH, tsContent, "utf8");
  console.log(`\n✅ ${stores.length}개 매장 저장: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((err) => {
  console.error("❌ 실패:", err);
  process.exit(1);
});
