#!/usr/bin/env node
/**
 * 41개 점포 상권 규모 점수 = 권역(수도권/광역시/지방) + 실측 상가밀도(유동인구 프록시)
 * → src/data/trade-area.json
 *
 * 인구를 임의로 하드코딩하지 않음. 이미 수집된 실데이터를 사용:
 *   data/trade-area/_index.json
 *     - 출처: 소상공인시장진흥공단 상가업소정보 OpenAPI (data.go.kr)
 *     - total: 점포 반경 500m 내 상가업소 수 = 상권 활성도/유동인구 프록시
 *       (전 점포 동일 반경 500m → 상호 비교 가능)
 *     - tradeAreaType / foodPct / retailPct: 상권 성격
 *   생성 스크립트: scripts/fetch-trade-area.mjs (SBIZ_API_KEY 필요, 이미 1회 수집됨)
 *
 * 권역: 수도권(서울·경기·인천) / 광역시(부산·대구·광주·대전·울산) / 지방(그 외)
 *
 * 실행: node scripts/build-trade-area.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── 1. 실측 상권 데이터 로드 ──
const idx = JSON.parse(readFileSync(path.resolve(ROOT, "data/trade-area/_index.json"), "utf-8"));

// ── 2. 41점 마스터 매칭 (이름 정규화) ──
const homeplus = readFileSync(path.resolve(ROOT, "src/data/homeplus.ts"), "utf-8");
const elandStores = eval(homeplus.match(/export const ELAND_STORES[^=]*=\s*(\[[\s\S]*?\n\]);/)[1]);
const normalize = (s) => s.replace(/^NC/, "").replace(/점$/, "").replace(/\s+/g, "");
const nameToId = new Map(elandStores.map((s) => [normalize(s.name), s.id]));
const idToStore = new Map(elandStores.map((s) => [s.id, s]));

// ── 3. 권역 분류 ──
const METRO = ["부산", "대구", "광주", "대전", "울산"];
const CAPITAL = ["서울", "경기", "인천"];
function regionTier(region) {
  const sido = region.split(/\s+/)[0];
  if (CAPITAL.includes(sido)) return "수도권";
  if (METRO.includes(sido)) return "광역시";
  return "지방";
}

const rows = idx.stores.map((s) => {
  const storeId = nameToId.get(normalize(s.name)) ?? null;
  return {
    storeId,
    storeName: storeId ? `${idToStore.get(storeId).brand} ${idToStore.get(storeId).name}` : `${s.brand} ${s.name}`,
    region: s.region,
    regionTier: regionTier(s.region),
    commercialDensity: s.total, // 반경 500m 상가업소 수
    tradeAreaType: s.tradeAreaType,
    foodPct: s.foodPct,
    retailPct: s.retailPct,
  };
});

const matched = rows.filter((r) => r.storeId !== null).sort((a, b) => a.storeId - b.storeId);
const unmatched = rows.filter((r) => r.storeId === null);
console.log(`41점 마스터 매칭: ${matched.length} / 41`);
if (unmatched.length) {
  console.error("❌ 매칭 실패:", unmatched.map((u) => u.storeName).join(", "));
  process.exit(1);
}

// ── 4. 상권규모 점수 산출 ──
//   sizeScore = 권역 기본점수 + 상가밀도 정규화 가산
//   권역 기본: 수도권 > 광역시 > 지방 (상권 위상/배후수요)
//   밀도 가산: 전 점포 min~max 정규화 → 0~RANGE (유동인구 차등)
const TIER_BASE = { "수도권": 55, "광역시": 42, "지방": 32 };
const DENSITY_RANGE = 45;
const densities = matched.map((m) => m.commercialDensity);
const MIN_D = Math.min(...densities);
const MAX_D = Math.max(...densities);

const stores = matched.map((m) => {
  const dNorm = (m.commercialDensity - MIN_D) / (MAX_D - MIN_D); // 0~1
  const sizeScore = Math.round(Math.min(100, TIER_BASE[m.regionTier] + dNorm * DENSITY_RANGE) * 10) / 10;
  return { ...m, sizeScore };
});

const out = {
  version: "2.0",
  compiledAt: new Date().toISOString().slice(0, 10),
  source: "권역 분류 + 소상공인시장진흥공단 상가업소정보(반경 500m 점포수, data.go.kr)",
  formula: `sizeScore = 권역기본(수도권 ${TIER_BASE["수도권"]}/광역시 ${TIER_BASE["광역시"]}/지방 ${TIER_BASE["지방"]}) + 상가밀도정규화(0~${DENSITY_RANGE}), 상한 100`,
  densityRange: { min: MIN_D, max: MAX_D },
  stores,
};
writeFileSync(path.resolve(ROOT, "src/data/trade-area.json"), JSON.stringify(out, null, 2));
console.log(`✅ src/data/trade-area.json 저장 (${stores.length}개점)`);

// ── 5. 검증 출력 ──
const ranked = [...stores].sort((a, b) => b.sizeScore - a.sizeScore);
const fmt = (s) => `${s.sizeScore} (${s.regionTier}/${s.region}/상가 ${s.commercialDensity}개)`;
console.log("\n📊 상권규모 TOP6:");
ranked.slice(0, 6).forEach((s, i) => console.log(`   ${i + 1}. ${s.storeName} ${fmt(s)}`));
console.log("📊 상권규모 BOTTOM6:");
ranked.slice(-6).reverse().forEach((s, i) => console.log(`   ${i + 1}. ${s.storeName} ${fmt(s)}`));
console.log(`\n고유 상권규모 점수: ${new Set(stores.map((s) => s.sizeScore)).size} / ${stores.length}`);
