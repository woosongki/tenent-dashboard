#!/usr/bin/env node
/**
 * store-demographics.json의 연령 비중으로 41개점 family_ratio 자동 분류
 * → src/data/eland-meta.ts의 trade_area.family_ratio 자동 채움
 *
 * 룰:
 *   - "가족 중심":  30~40대 합 ≥ 40% (생산층 가족 비중 높음)
 *   - "개인 중심":  50~60대 합 ≥ 75% (시니어·개인 소비 집중)
 *   - "둘 다":      나머지 (가족·시니어 균형형)
 *
 * 실행: node scripts/build-family-ratio.mjs
 */

import { readFileSync, writeFileSync } from "fs";

const FAMILY_THRESHOLD = 40;   // 30~40대 합 ≥ 이 값이면 가족 중심
const SENIOR_THRESHOLD = 75;   // 50~60대 합 ≥ 이 값이면 개인 중심

const demo = JSON.parse(readFileSync("src/data/store-demographics.json", "utf-8"));

function classify(s) {
  const total = s.totalCustomers - (s.byAge["미상"]?.customers ?? 0);
  if (total === 0) return null;
  const pct = (label) => ((s.byAge[label]?.customers ?? 0) / total) * 100;
  const young = pct("30대") + pct("40대");
  const senior = pct("50대") + pct("60대이상");
  if (young >= FAMILY_THRESHOLD) return "가족 중심";
  if (senior >= SENIOR_THRESHOLD) return "개인 중심";
  return "둘 다";
}

const idToFamily = new Map();
const dist = { "가족 중심": 0, "개인 중심": 0, "둘 다": 0 };
const detail = [];

demo.stores.forEach((s) => {
  if (!s.storeId) return;
  const ratio = classify(s);
  if (!ratio) return;
  idToFamily.set(s.storeId, ratio);
  dist[ratio]++;
  const total = s.totalCustomers - (s.byAge["미상"]?.customers ?? 0);
  const young = (((s.byAge["30대"]?.customers ?? 0) + (s.byAge["40대"]?.customers ?? 0)) / total) * 100;
  const senior = (((s.byAge["50대"]?.customers ?? 0) + (s.byAge["60대이상"]?.customers ?? 0)) / total) * 100;
  detail.push({ name: s.storeName, ratio, young: young.toFixed(1), senior: senior.toFixed(1) });
});

console.log("📊 분류 결과:");
Object.entries(dist).forEach(([r, n]) => console.log(`   ${r}: ${n}개점`));

console.log("\n[가족 중심 매장]");
detail.filter((d) => d.ratio === "가족 중심").forEach((d) => console.log(`   ${d.name} (30~40대 ${d.young}%, 50~60대 ${d.senior}%)`));

console.log("\n[개인 중심 매장]");
detail.filter((d) => d.ratio === "개인 중심").forEach((d) => console.log(`   ${d.name} (30~40대 ${d.young}%, 50~60대 ${d.senior}%)`));

// eland-meta.ts 업데이트
let metaContent = readFileSync("src/data/eland-meta.ts", "utf-8");
for (let id = 1; id <= 41; id++) {
  const ratio = idToFamily.get(id);
  if (!ratio) continue;
  const regex = new RegExp(`(store_id: ${id},[\\s\\S]*?family_ratio: )null`, "g");
  metaContent = metaContent.replace(regex, `$1${JSON.stringify(ratio)}`);
}
writeFileSync("src/data/eland-meta.ts", metaContent);
console.log("\n✅ src/data/eland-meta.ts family_ratio 자동 채움 완료");
