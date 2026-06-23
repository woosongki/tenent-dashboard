#!/usr/bin/env node
/**
 * 에잇세컨즈(8seconds) 전국 매장 위치 수집 (Kakao Local API)
 * 출력: src/data/eightseconds.ts
 * 실행: node scripts/fetch-eightseconds-stores.mjs
 *
 * ~90점 규모 — 광역단위만으로도 대부분 수집되지만 안전을 위해
 * abcmart와 동일한 시군구 분할 검색을 사용.
 * "에잇세컨즈" / "8SECONDS" / "8IGHT SECONDS" 표기 변형 허용.
 */

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "src/data/eightseconds.ts");

(function loadEnvLocal() {
  try {
    const txt = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
})();

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
if (!KAKAO_KEY) { console.error("❌ KAKAO_REST_API_KEY 미설정"); process.exit(1); }

const HEADERS = { Authorization: `KakaoAK ${KAKAO_KEY}` };
const SLEEP_MS = 80;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 에잇세컨즈는 매장수가 적어 시·도 단위로 충분.
const REGIONS = [
  "서울","부산","대구","인천","광주","대전","울산","세종",
  "경기 수원시","경기 성남시","경기 부천시","경기 안양시","경기 안산시","경기 고양시",
  "경기 용인시","경기 화성시","경기 평택시","경기 김포시","경기 의정부시","경기 파주시",
  "경기 광명시","경기 시흥시","경기 군포시","경기 하남시","경기 남양주시","경기 광주시",
  "강원","충북","충남","전북","전남","경북","경남","제주",
];

async function searchKeyword(query, page = 1) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=15`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Kakao ${res.status}`);
  return res.json();
}

// 첫 토큰이 8세컨즈류 — 사용자 정의 카테고리·노이즈 제외용.
function is8Seconds(place) {
  const name = String(place.place_name || "").trim();
  const head = name.replace(/[ \-]/g, "").toUpperCase();
  return (
    head.startsWith("에잇세컨즈") ||
    head.startsWith("8SECONDS") ||
    head.startsWith("8IGHTSECONDS")
  );
}

async function main() {
  const seen = new Map();
  for (const region of REGIONS) {
    process.stdout.write(`[${region}] `);
    let added = 0;
    // 한 지역에 대해 한국어/영문 두 키워드를 모두 시도해 누락 최소화.
    for (const kw of ["에잇세컨즈", "8seconds"]) {
      for (let page = 1; page <= 3; page++) {
        try {
          const data = await searchKeyword(`${region} ${kw}`, page);
          for (const d of (data.documents || [])) {
            if (!is8Seconds(d) || seen.has(d.id)) continue;
            seen.set(d.id, {
              id: d.id,
              name: d.place_name,
              addr: d.road_address_name || d.address_name || "",
              lat: parseFloat(d.y),
              lng: parseFloat(d.x),
            });
            added++;
          }
          if (data.meta?.is_end) break;
        } catch (err) {
          console.error(`\n  ⚠️  ${region}/${kw} p${page}: ${err.message}`);
          break;
        }
        await sleep(SLEEP_MS);
      }
    }
    process.stdout.write(`+${added} (누적 ${seen.size})\n`);
  }

  const stores = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const ts = `// 에잇세컨즈(8seconds) 전국 매장 위치 데이터
// 수집: Kakao Local API (scripts/fetch-eightseconds-stores.mjs)
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${stores.length}개 매장

import type { ChainStore } from "./artbox";

export const EIGHTSECONDS_STORES: ChainStore[] = ${JSON.stringify(stores, null, 2)};
`;
  await fs.writeFile(OUT_PATH, ts, "utf8");
  console.log(`\n✅ ${stores.length}개 매장 저장: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
