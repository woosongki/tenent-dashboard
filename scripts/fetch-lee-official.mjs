#!/usr/bin/env node
/**
 * LEE 코리아 오프라인 매장 수집 — 공식 홈페이지 스크레이핑 + Kakao 지오코딩.
 *
 * 왜 공식 스크레이핑인가:
 *   Kakao 키워드 "LEE" 는 김밥·미용실·자동차 등 잡음이 압도적. 브랜드 정확도 확보를 위해
 *   공식 매장 리스트를 원본으로 삼고, 주소만 Kakao 지오코딩으로 좌표 변환.
 *
 * 소스: https://leekorea.co.kr/store/stores_a/index.html  (약 80개)
 * 구조: <h3>매장명</h3> + 뒤이은 텍스트 노드(주소/시간/전화). 컨테이너·클래스 없음 → 정규식 분할.
 *
 * 출력: src/data/lee.ts (ChainStore[])
 * 실행: node scripts/fetch-lee-official.mjs
 */

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "src/data/lee.ts");

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

const KAKAO_HEADERS = { Authorization: `KakaoAK ${KAKAO_KEY}` };
const SLEEP_MS = 80;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SOURCES = [
  "https://leekorea.co.kr/store/stores_a/index.html",   // 오프라인 (성인)
  "https://leekorea.co.kr/store/stores/index.html",     // 오프라인 (키즈) — 성인점과 중복 다수, dedupe로 처리
];

// 시/도 시작 접두어 — 주소 판정용.
const ADDR_PREFIX = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/;

// HTML 엔티티 최소 디코딩(브라우저 없는 스크립트라 수동).
function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// <h2>...</h2> 로 페이지를 나누고, 각 조각의 h2 = 매장명, 뒤 텍스트 첫 시/도 라인 = 주소.
// (LEE 페이지: <h1>오프라인</h1> 아래 각 매장이 <h2>로 나열)
function parseStores(html) {
  const parts = html.split(/<h2\b[^>]*>/i);
  const out = [];
  for (const part of parts.slice(1)) {
    const end = part.indexOf("</h2>");
    if (end < 0) continue;
    const rawName = part.substring(0, end);
    const name = decodeEntities(rawName.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (!name) continue;
    const rest = part.substring(end + 5);
    // 다음 h2 등장 전까지의 텍스트만 대상으로.
    const nextH = rest.search(/<h[1-6]\b/i);
    const scope = nextH >= 0 ? rest.substring(0, nextH) : rest;
    const lines = stripTags(scope);
    const addr = lines.find((l) => ADDR_PREFIX.test(l));
    if (!addr) continue;
    out.push({ name, addr });
  }
  return out;
}

// 주소 지오코딩 (정확). 실패 시 키워드 검색 fallback (근사).
async function geocode(query) {
  // 1) 도로명·지번 주소 API
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: KAKAO_HEADERS });
    if (res.ok) {
      const j = await res.json();
      const d = j.documents?.[0];
      if (d) return { lat: parseFloat(d.y), lng: parseFloat(d.x), via: "address" };
    }
  } catch {}
  // 2) 키워드 검색 fallback — 주소 API가 정제된 도로명만 받아서 실패 케이스 대비.
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: KAKAO_HEADERS });
    if (res.ok) {
      const j = await res.json();
      const d = j.documents?.[0];
      if (d) return { lat: parseFloat(d.y), lng: parseFloat(d.x), via: "keyword" };
    }
  } catch {}
  return null;
}

// 주소 정제: 뒤쪽 "1층 Lee XX점" 같은 설명 꼬리를 잘라 지오코딩 정확도를 높인다.
function cleanAddr(addr) {
  // "…번지" 뒤나 "…길 N" 뒤의 설명은 지오코딩 실패의 주범.
  return String(addr)
    .replace(/\s*(1층|2층|3층|B1|B2|지하[0-9]+층)[^,]*$/i, "")
    .replace(/\s*Lee\b.*$/i, "")
    .replace(/\s*키즈.*$/, "")
    .trim();
}

async function main() {
  console.log("🏷  LEE (공식 홈페이지 + 지오코딩) 수집 시작");

  const seenName = new Map();  // 이름+주소 dedupe
  for (const url of SOURCES) {
    console.log(`  📥 ${url}`);
    const html = await fetchHtml(url);
    const rows = parseStores(html);
    console.log(`     +${rows.length} 매장 파싱`);
    for (const r of rows) {
      const key = `${r.name}|${r.addr}`;
      if (!seenName.has(key)) seenName.set(key, r);
    }
  }
  const list = Array.from(seenName.values());
  console.log(`\n총 ${list.length}개 매장 (dedupe 후) — 지오코딩 시작`);

  const stores = [];
  let ok = 0, fail = 0;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const cleaned = cleanAddr(r.addr);
    const g = await geocode(cleaned) || await geocode(r.addr);
    if (g) {
      stores.push({
        id: `lee-${i + 1}`,
        name: r.name,
        addr: r.addr,
        lat: g.lat,
        lng: g.lng,
      });
      ok++;
      process.stdout.write(".");
    } else {
      fail++;
      console.log(`\n  ⚠  좌표 실패: ${r.name} / ${r.addr}`);
    }
    await sleep(SLEEP_MS);
  }
  console.log(`\n✅ 지오코딩 성공 ${ok} / 실패 ${fail}`);

  stores.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const ts = `// LEE 전국 매장 위치 데이터
// 수집: 공식 홈페이지 스크레이핑 (leekorea.co.kr) + Kakao 지오코딩
// 스크립트: scripts/fetch-lee-official.mjs
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${stores.length}개 매장

import type { ChainStore } from "./artbox";

export const LEE_STORES: ChainStore[] = ${JSON.stringify(stores, null, 2)};
`;
  await fs.writeFile(OUT_PATH, ts, "utf8");
  console.log(`💾 저장: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
