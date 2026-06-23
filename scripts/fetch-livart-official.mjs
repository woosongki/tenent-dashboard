#!/usr/bin/env node
/**
 * 현대리바트 매장 좌표 수집 — 리바트몰 공식 API.
 * 엔드포인트: POST https://www.hyundailivart.co.kr/csCenter/selectShopInfoList
 *   - 사전: GET /csCenter/shopMgmt 로 X-CSRF-TOKEN 메타와 세션 쿠키 획득.
 *   - 본문: 전체 shopScnCd 체크 (01~80).
 * 응답: resultData.list[*]
 *   - 좌표 필드 주의: `la` = 경도(longitude), `lo` = 위도(latitude). (JS에서
 *     `new kakao.maps.LatLng(list[i].lo, list[i].la)` 사용으로 확인.)
 *
 * 필터: shopScnCd ∈ {20=리바트 매장, 80=리바트토탈, 01=리바트 가구 매장} —
 * 소비자 대면 쇼룸만 포함. 30/40/50/60(리모델링·오피스·해외·하움)·70(키즈)는 별도 채널이라 제외.
 *
 * 출력: src/data/livart.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "src/data/livart.ts");

const PAGE_URL = "https://www.hyundailivart.co.kr/csCenter/shopMgmt";
const LIST_URL = "https://www.hyundailivart.co.kr/csCenter/selectShopInfoList";

// 모든 shopScnCd 옵션 — 폼 정의(2401~2596행)와 동일.
const ALL_SHOP_SCN_CD = ["01","02","03","04","20","70","30","60","40","50","80"];
// 소비자 대면 매장 카테고리 — 리바트 매장(20), 리바트토탈(80), 리바트 가구 매장(01).
const RETAIL_SCN_CD = new Set(["20", "80", "01"]);

async function fetchSession() {
  const res = await fetch(PAGE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`page HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/<meta name="X-CSRF-TOKEN" content="([^"]+)"/);
  if (!m) throw new Error("CSRF token not found in /csCenter/shopMgmt");
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  return { csrf: m[1], cookie };
}

async function fetchShopList({ csrf, cookie }) {
  // arrShopScnCd 다중 — URLSearchParams로 동일 키 반복.
  const params = new URLSearchParams();
  params.append("pageNo", "1");
  params.append("pageSize", "1000");
  params.append("searchShopNm", "");
  for (const cd of ALL_SHOP_SCN_CD) params.append("arrShopScnCd", cd);

  const res = await fetch(LIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-TOKEN": csrf,
      "Referer": PAGE_URL,
      "Origin": "https://www.hyundailivart.co.kr",
      "User-Agent": "Mozilla/5.0",
      "Cookie": cookie,
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`list HTTP ${res.status}`);
  const j = await res.json();
  if (j.resultCode !== "00") throw new Error(`resultCode ${j.resultCode}: ${j.resultMsg}`);
  return j.resultData.list || [];
}

async function main() {
  console.log("🏷  현대리바트 (공식 API) 수집 시작");
  const sess = await fetchSession();
  console.log(`  CSRF·세션 획득`);
  const list = await fetchShopList(sess);
  console.log(`  전체 매장: ${list.length}개`);

  const retail = list.filter((s) => RETAIL_SCN_CD.has(s.shopScnCd));
  console.log(`  필터(20/80/01): ${retail.length}개`);

  const stores = retail
    .map((s) => {
      const addr = [s.draddr, s.draddrDtl].filter((v) => v && v !== "*").join(" ").trim();
      const lat = parseFloat(s.lo);  // 응답 lo = latitude
      const lng = parseFloat(s.la);  // 응답 la = longitude
      return {
        id: String(s.shopSn ?? s.erpShopId ?? `${s.shopNm}-${s.draddr}`),
        name: String(s.shopNm || "")
          .replace(/^\[휴점\]\s*/, "")
          .replace(/^\[직영점\s*\]\s*/, "")  // 표기 정리 — 마커 라벨 가독성
          .trim(),
        addr,
        lat,
        lng,
      };
    })
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.lat > 32 && s.lat < 40)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const ts = `// 현대리바트 전국 매장 위치 데이터
// 수집: 리바트몰 공식 API hyundailivart.co.kr/csCenter/selectShopInfoList (shopScnCd ∈ {20,80,01})
// 스크립트: scripts/fetch-livart-official.mjs
// 마지막 갱신: ${new Date().toISOString()}
// 총 ${stores.length}개 매장

import type { ChainStore } from "./artbox";

export const LIVART_STORES: ChainStore[] = ${JSON.stringify(stores, null, 2)};
`;
  await fs.writeFile(OUT_PATH, ts, "utf8");
  console.log(`✅ ${stores.length}개 저장: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
