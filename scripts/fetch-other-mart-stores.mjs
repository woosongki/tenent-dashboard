#!/usr/bin/env node
/**
 * 그 외(AK백화점/엔터식스/모다아울렛/세이브존/LF몰) + 마트(이마트/롯데마트/하나로마트) 수집
 * 출력: src/data/{ak,entersix,moda,savezone,lf,emart,lottemart,hanaromart}.ts
 * 실행: node scripts/fetch-other-mart-stores.mjs
 *
 * 매장 규모가 다양해 시군구 단위 검색으로 누락 최소화.
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

// 시군구 단위 (다이소 패턴 재사용)
const REGIONS = [
  "서울 강남구","서울 강동구","서울 강북구","서울 강서구","서울 관악구","서울 광진구","서울 구로구",
  "서울 금천구","서울 노원구","서울 도봉구","서울 동대문구","서울 동작구","서울 마포구","서울 서대문구",
  "서울 서초구","서울 성동구","서울 성북구","서울 송파구","서울 양천구","서울 영등포구","서울 용산구",
  "서울 은평구","서울 종로구","서울 중구","서울 중랑구",
  "부산 강서구","부산 금정구","부산 남구","부산 동구","부산 동래구","부산 부산진구","부산 북구",
  "부산 사상구","부산 사하구","부산 서구","부산 수영구","부산 연제구","부산 영도구","부산 중구","부산 해운대구","부산 기장군",
  "대구 남구","대구 달서구","대구 동구","대구 북구","대구 서구","대구 수성구","대구 중구","대구 달성군",
  "인천 계양구","인천 남동구","인천 동구","인천 미추홀구","인천 부평구","인천 서구","인천 연수구","인천 중구",
  "광주 광산구","광주 남구","광주 동구","광주 북구","광주 서구",
  "대전 대덕구","대전 동구","대전 서구","대전 유성구","대전 중구",
  "울산 남구","울산 동구","울산 북구","울산 중구","울산 울주군",
  "세종",
  "경기 수원시","경기 성남시","경기 의정부시","경기 안양시","경기 부천시","경기 광명시","경기 평택시",
  "경기 안산시","경기 고양시","경기 남양주시","경기 용인시","경기 파주시","경기 시흥시","경기 군포시",
  "경기 의왕시","경기 하남시","경기 김포시","경기 화성시","경기 광주시","경기 양주시","경기 포천시",
  "경기 이천시","경기 안성시","경기 여주시","경기 가평군","경기 양평군","경기 연천군","경기 구리시",
  "경기 동두천시","경기 오산시","경기 과천시",
  "강원 춘천","강원 원주","강원 강릉","강원 동해","강원 속초","강원 삼척","강원 태백","강원",
  "충북 청주","충북 충주","충북 제천","충북",
  "충남 천안","충남 아산","충남 공주","충남 보령","충남 서산","충남 논산","충남 당진","충남",
  "전북 전주","전북 군산","전북 익산","전북 정읍","전북 남원","전북 김제","전북",
  "전남 목포","전남 여수","전남 순천","전남 광양","전남 나주","전남",
  "경북 포항","경북 경주","경북 김천","경북 안동","경북 구미","경북 영주","경북",
  "경남 창원","경남 김해","경남 진주","경남 양산","경남 거제","경남 통영","경남 사천","경남 밀양","경남",
  "제주 제주시","제주 서귀포시",
];

const CHAINS = [
  // ── 그 외 ── (AK백화점은 fetch-dept-stores.mjs로 이동)
  {
    keyword: "엔터식스",
    outFile: "entersix.ts",
    varName: "ENTERSIX_STORES",
    label: "엔터식스",
    matcher: (name) => /^엔터식스\s\S{1,12}점$/.test(name.trim()),
  },
  {
    keyword: "모다아울렛",
    outFile: "moda.ts",
    varName: "MODA_STORES",
    label: "모다아울렛",
    matcher: (name) => /^모다아울렛\s\S{1,12}점$/.test(name.trim()),
  },
  {
    keyword: "세이브존",
    outFile: "savezone.ts",
    varName: "SAVEZONE_STORES",
    label: "세이브존",
    matcher: (name) => /^세이브존(\s\S{1,12}점)?$/.test(name.trim()),
  },
  {
    keyword: "LF스퀘어",
    outFile: "lf.ts",
    varName: "LF_STORES",
    label: "LF스퀘어",
    // 정확히 "LF스퀘어 OO점" 형식만 (주차장/화장실 노이즈 제외)
    matcher: (name) => /^LF스퀘어\s\S{1,12}점$/i.test(name.trim()),
  },
  {
    keyword: "모던하우스",
    outFile: "modernhouse.ts",
    varName: "MODERNHOUSE_STORES",
    label: "모던하우스",
    // "모던하우스 OO점" 형식만 (모던하우스공통(MODERN HOUSE) 등 노이즈 제외)
    matcher: (name) => {
      const n = name.trim();
      if (n.includes("(") || n.includes("공통") || n.includes("주차") || n.includes("창고")) return false;
      return /^모던하우스\s\S{1,15}점$/.test(n);
    },
  },
  // ── 마트 ──
  {
    keyword: "이마트",
    outFile: "emart.ts",
    varName: "EMART_STORES",
    label: "이마트",
    // 이마트24(편의점), 이마트 트레이더스 분리. 본 매장만.
    matcher: (name) => {
      const n = name.trim();
      if (/이마트24/.test(n)) return false;
      if (/트레이더스/.test(n)) return false;
      if (/이마트에브리데이/.test(n)) return false;
      return /^이마트\s\S{1,12}점$/.test(n);
    },
  },
  {
    keyword: "롯데마트",
    outFile: "lottemart.ts",
    varName: "LOTTEMART_STORES",
    label: "롯데마트",
    matcher: (name) => {
      const n = name.trim();
      if (/VIC/.test(n)) return false;  // 빅마켓 별도 분류
      return /^롯데마트\s\S{1,12}점$/.test(n) || /^롯데Mart\s\S{1,12}점$/i.test(n);
    },
  },
  {
    keyword: "하나로마트",
    outFile: "hanaromart.ts",
    varName: "HANAROMART_STORES",
    label: "하나로마트",
    matcher: (name) => {
      const n = name.trim();
      // "하나로마트 OO점", "농협하나로마트 OO점", "하나로클럽 OO점"
      return /^(농협)?하나로(마트|클럽)\s\S{1,15}점$/.test(n) || /^(농협)?하나로마트(\s|$)/.test(n);
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
// 수집: Kakao Local API (scripts/fetch-other-mart-stores.mjs)
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
  console.log("\n🎉 그 외 + 마트 수집 완료");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
