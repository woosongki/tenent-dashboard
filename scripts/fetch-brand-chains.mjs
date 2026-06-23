#!/usr/bin/env node
/**
 * 멀티 브랜드 매장 좌표 일괄 수집 (Kakao Local API).
 * 출력: src/data/{muji,hanssem,livart,iloom,nitori,uniqlo}.ts
 * 실행: node scripts/fetch-brand-chains.mjs [brand1 brand2 ...]
 *
 * 인자 미지정 시 전부 수집. 시군구 단위 분할 검색 + 카테고리 휴리스틱.
 * abcmart 스크립트와 동일한 REGIONS, 다만 한 파일에서 N개 브랜드 처리.
 */

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "src/data");

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
  "경기 동두천시","경기 안산시","경기 고양시","경기 과천시","경기 구리시","경기 남양주시","경기 오산시",
  "경기 시흥시","경기 군포시","경기 의왕시","경기 하남시","경기 용인시","경기 파주시","경기 이천시",
  "경기 안성시","경기 김포시","경기 화성시","경기 광주시","경기 양주시","경기 포천시","경기 여주시",
  "강원 춘천","강원 원주","강원 강릉","강원 동해","강원 속초",
  "충북 청주","충북 충주","충북 제천",
  "충남 천안","충남 아산","충남 공주","충남 보령","충남 서산","충남 논산","충남 당진",
  "전북 전주","전북 군산","전북 익산","전북 정읍",
  "전남 목포","전남 여수","전남 순천","전남 광양","전남 나주",
  "경북 포항","경북 경주","경북 김천","경북 안동","경북 구미",
  "경남 창원","경남 김해","경남 진주","경남 양산","경남 거제","경남 통영",
  "제주 제주시","제주 서귀포시",
];

// 한국어/영문 표기 정규화: 공백·하이픈 제거 후 대문자.
function norm(s) {
  return String(s || "").trim().replace(/[ \-·\.]/g, "").toUpperCase();
}

// 한샘은 가구·인테리어 카테고리만(부동산·학원·병원 등 동음 노이즈 차단).
function categoryAllows(catName, requireFurniture) {
  if (!requireFurniture) return true;
  const c = String(catName || "");
  return /가구|인테리어|생활용품|홈인테리어/.test(c);
}

const BRANDS = [
  {
    key: "muji",
    const: "MUJI_STORES",
    file: "muji.ts",
    label: "무인양품",
    keywords: ["무인양품", "MUJI"],
    matches: (name) => {
      const h = norm(name);
      return h.startsWith("무인양품") || h.startsWith("MUJI");
    },
    requireFurniture: false,
  },
  // 한샘디자인파크/현대리바트는 공식 API에 좌표가 포함돼 있어 별도 스크립트로 분리.
  // → scripts/fetch-hanssem-official.mjs, scripts/fetch-livart-official.mjs
  {
    key: "iloom",
    const: "ILOOM_STORES",
    file: "iloom.ts",
    label: "일룸",
    keywords: ["일룸", "iloom"],
    matches: (name) => {
      const h = norm(name);
      return h.startsWith("일룸") || h.startsWith("ILOOM");
    },
    requireFurniture: false,
  },
  {
    key: "nitori",
    const: "NITORI_STORES",
    file: "nitori.ts",
    label: "니토리",
    keywords: ["니토리", "NITORI"],
    matches: (name) => {
      const h = norm(name);
      return h.startsWith("니토리") || h.startsWith("NITORI");
    },
    requireFurniture: false,
  },
  {
    key: "uniqlo",
    const: "UNIQLO_STORES",
    file: "uniqlo.ts",
    label: "유니클로",
    keywords: ["유니클로", "UNIQLO"],
    matches: (name) => {
      const h = norm(name);
      return h.startsWith("유니클로") || h.startsWith("UNIQLO");
    },
    requireFurniture: false,
  },
  {
    key: "spao",
    const: "SPAO_STORES",
    file: "spao.ts",
    label: "스파오",
    keywords: ["스파오", "SPAO"],
    matches: (name) => {
      const h = norm(name);
      return h.startsWith("스파오") || h.startsWith("SPAO");
    },
    requireFurniture: false,
  },
  {
    key: "mixxo",
    const: "MIXXO_STORES",
    file: "mixxo.ts",
    label: "미쏘",
    keywords: ["미쏘", "MIXXO"],
    matches: (name) => {
      const h = norm(name);
      return h.startsWith("미쏘") || h.startsWith("MIXXO");
    },
    requireFurniture: false,
  },
];

async function searchKeyword(query, page = 1) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=15`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Kakao ${res.status}`);
  return res.json();
}

async function fetchBrand(brand) {
  console.log(`\n🏷  [${brand.label}] 수집 시작`);
  const seen = new Map();
  for (const region of REGIONS) {
    process.stdout.write(`  [${region}] `);
    let added = 0;
    for (const kw of brand.keywords) {
      for (let page = 1; page <= 3; page++) {
        try {
          const data = await searchKeyword(`${region} ${kw}`, page);
          for (const d of (data.documents || [])) {
            if (seen.has(d.id)) continue;
            if (!brand.matches(d.place_name)) continue;
            if (!categoryAllows(d.category_name, brand.requireFurniture)) continue;
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
          console.error(`\n    ⚠️  ${region}/${kw} p${page}: ${err.message}`);
          break;
        }
        await sleep(SLEEP_MS);
      }
    }
    process.stdout.write(`+${added} (누적 ${seen.size})\n`);
  }

  const stores = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const outPath = path.join(OUT_DIR, brand.file);
  const ts = `// ${brand.label} 전국 매장 위치 데이터
// 수집: Kakao Local API (scripts/fetch-brand-chains.mjs)
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${stores.length}개 매장

import type { ChainStore } from "./artbox";

export const ${brand.const}: ChainStore[] = ${JSON.stringify(stores, null, 2)};
`;
  await fs.writeFile(outPath, ts, "utf8");
  console.log(`✅ [${brand.label}] ${stores.length}개 저장: ${path.relative(ROOT, outPath)}`);
  return { brand, count: stores.length };
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length === 0 ? BRANDS : BRANDS.filter((b) => args.includes(b.key));
  if (targets.length === 0) {
    console.error("❌ 매칭 브랜드 없음. 사용 가능: " + BRANDS.map((b) => b.key).join(", "));
    process.exit(1);
  }

  const summary = [];
  for (const brand of targets) {
    summary.push(await fetchBrand(brand));
  }

  console.log("\n── 요약 ──");
  for (const { brand, count } of summary) {
    console.log(`  ${brand.label.padEnd(12)} ${count}점`);
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
