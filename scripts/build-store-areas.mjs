#!/usr/bin/env node
/**
 * 지점별 × 층별 전용면적(㎡) 데이터를
 * → src/data/store-areas.json 저장 (㎡ + 평 환산)
 *
 * 용도: 브랜드 적합도(score.ts) 매장 규모(전용면적) 신호.
 *   기존 "브랜드 수" 기반 규모 추정을 실제 전용면적으로 대체 → 더 촘촘한 차등.
 *
 * 입력: data/raw/store-areas-raw.txt (탭 구분, 4자리 플랜트코드로 시작하는 라인만 사용)
 *   컬럼: 플랜트 | 점포명 | 전체결과 | 0 | 1 | 2 ... 13 | B1 | B2
 * 실행: node scripts/build-store-areas.mjs
 */

import { readFileSync, writeFileSync } from "fs";

const M2_PER_PYEONG = 3.3058; // 1평 = 3.3058㎡
const RAW_PATH = "data/raw/store-areas-raw.txt";

// 층 라벨 (전체결과 다음 컬럼부터)
const FLOOR_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "B1", "B2"];

function toNum(s) {
  const v = String(s ?? "").replace(/,/g, "").trim();
  if (v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
const m2ToPy = (m2) => Math.round((m2 / M2_PER_PYEONG) * 10) / 10;

// 1. 원본 파싱 (4자리 코드로 시작하는 탭 구분 라인만)
const lines = readFileSync(RAW_PATH, "utf-8").split(/\r?\n/);
const rows = lines.filter((l) => /^\d{4}\t/.test(l));

const stores = rows.map((line) => {
  const p = line.split("\t");
  const code = p[0];
  const name = p[1];
  const totalM2 = toNum(p[2]);

  const perFloorM2 = {};
  FLOOR_LABELS.forEach((label, i) => {
    const v = toNum(p[3 + i]);
    if (v > 0) perFloorM2[label] = v;
  });

  const floorValsM2 = Object.values(perFloorM2);
  const floorCount = floorValsM2.length;
  const maxFloorM2 = floorCount ? Math.max(...floorValsM2) : 0;
  const avgFloorM2 = floorCount ? floorValsM2.reduce((a, b) => a + b, 0) / floorCount : 0;

  const perFloorPyeong = {};
  for (const [k, v] of Object.entries(perFloorM2)) perFloorPyeong[k] = m2ToPy(v);

  return {
    storeCode: code,
    storeName: name,
    totalAreaM2: Math.round(totalM2 * 10) / 10,
    totalAreaPyeong: m2ToPy(totalM2),
    floorCount,
    maxFloorPyeong: m2ToPy(maxFloorM2),
    avgFloorPyeong: m2ToPy(avgFloorM2),
    perFloorPyeong,
  };
});

// 2. 41점 마스터 매칭
const homeplusContent = readFileSync("src/data/homeplus.ts", "utf-8");
const match = homeplusContent.match(/export const ELAND_STORES[^=]*=\s*(\[[\s\S]*?\n\]);/);
const elandStores = eval(match[1]);
const normalize = (s) => s.replace(/^NC/, "").replace(/점$/, "").replace(/\s+/g, "");
const nameToId = new Map();
elandStores.forEach((s) => nameToId.set(normalize(s.name), s.id));

const allEnriched = stores.map((st) => ({
  storeId: nameToId.get(normalize(st.storeName)) ?? null,
  ...st,
}));
const enriched = allEnriched
  .filter((s) => s.storeId !== null)
  .sort((a, b) => a.storeId - b.storeId);
const excluded = allEnriched.filter((s) => s.storeId === null);

console.log(`41점 마스터 매칭: ${enriched.length} / 41`);
if (excluded.length > 0) {
  console.log(`제외된 ${excluded.length}개점 (마스터 미존재):`);
  excluded.forEach((s) => console.log(`  ${s.storeCode} ${s.storeName} (전용 ${s.totalAreaPyeong}평)`));
}

// 3. JSON 저장
const totalPys = enriched.map((s) => s.totalAreaPyeong);
const out = {
  version: "1.0",
  compiledAt: new Date().toISOString().slice(0, 10),
  source: "ERP 지점별 × 층별 전용면적(㎡)",
  unit: { areaM2: "㎡", areaPyeong: "평(1평=3.3058㎡)" },
  stats: {
    maxTotalPyeong: Math.max(...totalPys),
    minTotalPyeong: Math.min(...totalPys),
    medianTotalPyeong: (() => {
      const a = [...totalPys].sort((x, y) => x - y);
      const m = Math.floor(a.length / 2);
      return a.length % 2 ? a[m] : Math.round(((a[m - 1] + a[m]) / 2) * 10) / 10;
    })(),
  },
  stores: enriched,
};
writeFileSync("src/data/store-areas.json", JSON.stringify(out, null, 2));
console.log(`✅ src/data/store-areas.json 저장 (${enriched.length}개점)`);
console.log(`   전용면적 범위: ${out.stats.minTotalPyeong}평 ~ ${out.stats.maxTotalPyeong}평 (중앙값 ${out.stats.medianTotalPyeong}평)`);

// 4. 규모 순위 (상위/하위 5개)
const ranked = [...enriched].sort((a, b) => b.totalAreaPyeong - a.totalAreaPyeong);
console.log("\n📊 전용면적 TOP5:");
ranked.slice(0, 5).forEach((s, i) => console.log(`   ${i + 1}. ${s.storeName} ${s.totalAreaPyeong}평 (${s.floorCount}개층)`));
console.log("📊 전용면적 BOTTOM5:");
ranked.slice(-5).reverse().forEach((s, i) => console.log(`   ${i + 1}. ${s.storeName} ${s.totalAreaPyeong}평 (${s.floorCount}개층)`));
