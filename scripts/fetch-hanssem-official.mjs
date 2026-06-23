#!/usr/bin/env node
/**
 * 한샘디자인파크 매장 좌표 수집 — 한샘 공식 API.
 * 엔드포인트: GET https://gateway.hanssem.com/hanssem/shop-service/api/v1/shops
 *   ?page=1&size=200&groupCode=ALL
 * 응답 ListShopResponse에 좌표(address.coordinates)가 포함되므로 별도 카카오 호출 불필요.
 *
 * 필터: type.code === "S01" (한샘 직영 — 플래그십·디자인파크·백화점 입점 매장).
 * S05/S07(대리점)은 제외 — 사이드바 "한샘디자인파크" 정의에서 벗어남.
 *
 * 출력: src/data/hanssem.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "src/data/hanssem.ts");

const BASE = "https://gateway.hanssem.com/hanssem/shop-service/api/v1/shops";
const HEADERS = {
  "Accept": "application/json",
  "Origin": "https://remodeling.hanssem.com",
  "Referer": "https://remodeling.hanssem.com/shop/search",
  "User-Agent": "Mozilla/5.0",
};

async function fetchPage(page) {
  const url = `${BASE}?page=${page}&size=200&groupCode=ALL`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  const j = await res.json();
  if (j.code !== 200) throw new Error(`API code ${j.code}: ${j.message}`);
  return j.data;
}

async function main() {
  console.log("🏷  한샘디자인파크 (공식 API) 수집 시작");
  const first = await fetchPage(1);
  const totalPages = first.totalPages;
  console.log(`  총 ${first.totalElements}개 / ${totalPages}페이지`);

  const all = [...first.content];
  for (let p = 2; p <= totalPages; p++) {
    const d = await fetchPage(p);
    all.push(...d.content);
    console.log(`  page ${p}: +${d.content.length}`);
  }

  // S01 = 한샘 직영 (디자인파크·플래그십·백화점 입점).
  const filtered = all.filter((s) => s?.type?.code === "S01");
  console.log(`  필터 S01: ${filtered.length}개`);

  const stores = filtered
    .map((s) => {
      const addr = s.address || {};
      const c = addr.coordinates || {};
      const dpName = (s.dpName || s.name || "").trim();
      return {
        id: String(s.id),
        // 매장명은 "한샘 {dpName}" — 사이드바·툴팁에서 브랜드 식별이 명확.
        name: dpName.startsWith("한샘") ? dpName : `한샘 ${dpName}`,
        addr: [addr.basic, addr.detail].filter(Boolean).join(" ").trim(),
        lat: Number(c.latitude),
        lng: Number(c.longitude),
      };
    })
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const ts = `// 한샘디자인파크 전국 매장 위치 데이터
// 수집: 한샘 공식 API gateway.hanssem.com/hanssem/shop-service/api/v1/shops (S01=한샘 직영)
// 스크립트: scripts/fetch-hanssem-official.mjs
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${stores.length}개 매장

import type { ChainStore } from "./artbox";

export const HANSSEM_STORES: ChainStore[] = ${JSON.stringify(stores, null, 2)};
`;
  await fs.writeFile(OUT_PATH, ts, "utf8");
  console.log(`✅ ${stores.length}개 저장: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
