#!/usr/bin/env node
/**
 * 점포 × 브랜드 매출 매트릭스를 파싱하여
 * → src/data/store-brands.json (점포별 입점 브랜드 리스트)
 * → src/data/eland-meta.ts의 anchors 자동 채움 (TOP10 by 매출)
 *
 * 필터: 매출 < 100,000원 (10만원 이하) → 미입점으로 간주
 *
 * 입력: data/raw/store-brand-sales-2026-04.tsv
 *   - 1행: "브랜드(Now)" + 브랜드명들 (tab 구분)
 *   - 2행~: 점포명 + 매출값들
 *
 * 실행: node scripts/build-store-brands.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const PERIOD = "2026-04";
const THRESHOLD = 100_000; // 10만원 이하 미입점
const ANCHOR_TOP_N = 10;   // 매출 TOP N을 anchor로 추정

const tsvPath = join(process.cwd(), "data/raw/store-brand-sales-2026-04.tsv");
if (!existsSync(tsvPath)) {
  console.error("❌ 입력 파일 없음:", tsvPath);
  process.exit(1);
}

// ── TSV 파싱 ───────────────────────────────────────────────
const text = readFileSync(tsvPath, "utf-8").replace(/\r\n/g, "\n");
const allLines = text.split("\n");

// 헤더 자동 인식: "브랜드(Now)"로 시작하는 줄을 찾아 그 줄부터 시작
const headerIdx = allLines.findIndex((l) => l.startsWith("브랜드(Now)"));
if (headerIdx === -1) {
  console.error("❌ 헤더 라인 ('브랜드(Now)'로 시작) 못 찾음");
  process.exit(1);
}
const lines = allLines.slice(headerIdx).filter((l) => l.trim().length > 0);
const headerCells = lines[0].split("\t");
const brandNames = headerCells.slice(1).map((s) => s.trim()); // 첫 셀은 "브랜드(Now)"
console.log(`헤더 위치: 줄 ${headerIdx + 1} → 브랜드 ${brandNames.length}개 인식`);

function parseValue(raw) {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (v.includes("#")) return null; // Excel 컬럼 폭 초과 (#####, ####)
  const n = Number(v.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

const stores = [];
for (let i = 1; i < lines.length; i++) {
  const cells = lines[i].split("\t");
  const storeName = cells[0]?.trim();
  if (!storeName) continue;
  const brands = [];
  for (let j = 1; j < cells.length && j <= brandNames.length; j++) {
    const sales = parseValue(cells[j]);
    if (sales === null) continue;
    if (sales <= THRESHOLD) continue; // 10만원 이하 미입점
    brands.push({ brand: brandNames[j - 1], sales });
  }
  // 매출 내림차순
  brands.sort((a, b) => b.sales - a.sales);
  stores.push({
    storeName,
    brandCount: brands.length,
    totalSales: brands.reduce((s, b) => s + b.sales, 0),
    topAnchors: brands.slice(0, ANCHOR_TOP_N).map((b) => b.brand),
    brands,
  });
}

console.log(`점포: ${stores.length}개 파싱`);

// ── 41점 마스터 매칭 ────────────────────────────────────────
const homeplusContent = readFileSync("src/data/homeplus.ts", "utf-8");
const match = homeplusContent.match(/export const ELAND_STORES[^=]*=\s*(\[[\s\S]*?\n\]);/);
const elandStores = eval(match[1]);
function normalize(s) {
  return s.replace(/^NC/, "").replace(/점$/, "").replace(/\s+/g, "");
}
const nameToId = new Map();
elandStores.forEach((s) => nameToId.set(normalize(s.name), s.id));

const enriched = stores.map((st) => ({
  storeId: nameToId.get(normalize(st.storeName)) ?? null,
  ...st,
}));

const matched = enriched.filter((s) => s.storeId !== null);
const excluded = enriched.filter((s) => s.storeId === null);
console.log(`41점 마스터 매칭: ${matched.length} / 41`);
if (excluded.length > 0) {
  console.log("제외:");
  excluded.forEach((s) => console.log(`  ${s.storeName} (브랜드 ${s.brandCount}개, 매출 ${Math.round(s.totalSales / 1e8)}억)`));
}

// ── JSON 저장 ───────────────────────────────────────────────
const out = {
  $schema: "./store-brands.schema.json",
  version: "1.0",
  compiledAt: new Date().toISOString().slice(0, 10),
  period: PERIOD,
  source: "ERP 4월 점포 × 브랜드 매출 매트릭스",
  filterRule: `매출 ${THRESHOLD.toLocaleString()}원 이하 미입점으로 간주`,
  totalBrandsInUniverse: brandNames.length,
  stores: matched,
};
writeFileSync("src/data/store-brands.json", JSON.stringify(out, null, 2));
console.log(`✅ src/data/store-brands.json 저장 (${matched.length}개점)`);

// ── eland-meta.ts anchors 자동 채움 ─────────────────────────
const idToAnchors = new Map();
matched.forEach((s) => idToAnchors.set(s.storeId, s.topAnchors));

let metaContent = readFileSync("src/data/eland-meta.ts", "utf-8");
for (let id = 1; id <= 41; id++) {
  const anchors = idToAnchors.get(id);
  if (!anchors || anchors.length === 0) continue;
  const regex = new RegExp(`(store_id: ${id},[\\s\\S]*?anchors: )\\[\\]`, "g");
  metaContent = metaContent.replace(regex, `$1${JSON.stringify(anchors)}`);
}
writeFileSync("src/data/eland-meta.ts", metaContent);
console.log("✅ src/data/eland-meta.ts anchors 자동 채움 완료 (TOP10 by 매출)");

// ── 요약 통계 ─────────────────────────────────────────────
console.log("\n📊 점포별 입점 브랜드 수 (Top 10):");
[...matched]
  .sort((a, b) => b.brandCount - a.brandCount)
  .slice(0, 10)
  .forEach((s) => console.log(`   ${s.storeName}: ${s.brandCount}개 (매출 ${Math.round(s.totalSales / 1e8)}억)`));

console.log("\n📊 점포별 입점 브랜드 수 (Bottom 5):");
[...matched]
  .sort((a, b) => a.brandCount - b.brandCount)
  .slice(0, 5)
  .forEach((s) => console.log(`   ${s.storeName}: ${s.brandCount}개`));

// 가장 흔한 브랜드 (몇 개 점포에 입점)
const brandStoreCount = new Map();
matched.forEach((s) => s.brands.forEach((b) => {
  brandStoreCount.set(b.brand, (brandStoreCount.get(b.brand) ?? 0) + 1);
}));
const ubiquitous = [...brandStoreCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);
console.log("\n📊 가장 많이 입점된 브랜드 Top 15:");
ubiquitous.forEach(([b, n]) => console.log(`   ${b}: ${n}개점`));
