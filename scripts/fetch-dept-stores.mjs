#!/usr/bin/env node
/**
 * 백화점 3사 (롯데/현대/신세계) 전국 매장 위치 수집
 * 출력:
 *   - src/data/lotte.ts
 *   - src/data/hyundai.ts
 *   - src/data/shinsegae.ts
 * 실행: node scripts/fetch-dept-stores.mjs
 *
 * 매장 수가 30개 안팎으로 작아 17 시도 단위 검색으로 충분.
 */

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 각 체인별 검색 키워드와 필터 — 백화점 본 건물만 추출
// (입점 브랜드 "OO 현대백화점 OO점" 같은 매장 제외)
const CHAINS = [
  {
    keyword: "롯데백화점",
    outFile: "lotte.ts",
    varName: "LOTTE_STORES",
    label: "롯데백화점",
    // "롯데백화점 OO점" 만 (주차장/별관/입점브랜드 제외)
    matcher: (name) => /^롯데백화점\s\S{1,10}점$/.test(name.trim()),
  },
  {
    keyword: "현대백화점",
    outFile: "hyundai.ts",
    varName: "HYUNDAI_STORES",
    label: "현대백화점",
    // "현대백화점 OO점" 또는 "더현대 OO" (서울/대구/광주 등)
    matcher: (name) => {
      const n = name.trim();
      return /^현대백화점\s\S{1,10}점$/.test(n) || /^더현대\s[가-힣]{1,4}$/.test(n);
    },
  },
  {
    keyword: "신세계백화점",
    outFile: "shinsegae.ts",
    varName: "SHINSEGAE_STORES",
    label: "신세계백화점",
    // "신세계백화점 OO점" 또는 "OO신세계백화점" (광주신세계백화점 등)
    matcher: (name) => {
      const n = name.trim();
      return /^신세계백화점\s\S{1,10}점$/.test(n) || /^[가-힣]{2,4}신세계백화점$/.test(n);
    },
  },
];

async function searchKeyword(query, page = 1) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=15`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Kakao ${res.status}`);
  return res.json();
}

async function collectChain(chain) {
  console.log(`\n── ${chain.label} ──`);
  const seen = new Map();
  for (const region of REGIONS) {
    process.stdout.write(`[${region}] `);
    let added = 0;
    for (let page = 1; page <= 3; page++) {
      try {
        const data = await searchKeyword(`${region} ${chain.keyword}`, page);
        for (const d of (data.documents || [])) {
          if (!chain.matcher(d.place_name) || seen.has(d.id)) continue;
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
        console.error(`\n  ⚠️  ${region} p${page}: ${err.message}`);
        break;
      }
      await sleep(SLEEP_MS);
    }
    process.stdout.write(`+${added} (누적 ${seen.size})\n`);
  }

  const stores = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const outPath = path.join(ROOT, "src/data", chain.outFile);
  const ts = `// ${chain.label} 전국 매장 위치 데이터
// 수집: Kakao Local API (scripts/fetch-dept-stores.mjs)
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${stores.length}개 매장

import type { ChainStore } from "./artbox";

export const ${chain.varName}: ChainStore[] = ${JSON.stringify(stores, null, 2)};
`;
  await fs.writeFile(outPath, ts, "utf8");
  console.log(`✅ ${chain.label} ${stores.length}개 → ${path.relative(ROOT, outPath)}`);
}

async function main() {
  for (const chain of CHAINS) {
    await collectChain(chain);
  }
  console.log("\n🎉 백화점 3사 수집 완료");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
