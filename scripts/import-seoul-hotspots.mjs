/* eslint-disable no-console */
/**
 * 서울 실시간 도시데이터의 121개 핫스팟 권역 목록 (XLSX)을
 * src/data/seoul-hotspots.json 으로 변환.
 *
 * 입력: data/seoul-hotspots.xlsx (사용자가 서울 데이터광장에서 다운로드)
 * 출력: src/data/seoul-hotspots.json
 *
 * 사용: node scripts/import-seoul-hotspots.mjs
 */

import XLSX from "xlsx";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "data/seoul-hotspots.xlsx");
const OUT = resolve(ROOT, "src/data/seoul-hotspots.json");

// .env.local에서 KAKAO_REST_API_KEY 로드
(function loadEnv() {
  try {
    const txt = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
})();
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// 카카오 키워드/주소 검색 — 권역명을 좌표로
async function geocodeKakao(name) {
  if (!KAKAO_KEY) return null;
  // 권역명에 "서울" prefix 붙여서 정확도 향상
  const queries = [`서울 ${name}`, name];
  for (const q of queries) {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?` +
        new URLSearchParams({ query: q, size: "1" });
      const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const hit = json.documents?.[0];
      if (hit?.x && hit?.y) {
        return {
          lat: parseFloat(hit.y),
          lng: parseFloat(hit.x),
          gu: hit.address?.region_2depth_name ?? hit.road_address?.region_2depth_name ?? null,
        };
      }
    } catch {}
  }
  return null;
}

function toNum(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const wb = XLSX.readFile(SRC, { type: "file" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // 헤더 행 찾기 — "장소명" 또는 "AREA_NM" 또는 "권역명" 키워드 포함
  let headerIdx = -1;
  let columns = null;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i].map((c) => String(c).trim());
    const has = (kw) => r.some((c) => c.includes(kw));
    if (has("장소명") || has("AREA_NM") || has("권역명")) {
      headerIdx = i;
      columns = r;
      break;
    }
  }
  if (headerIdx < 0) {
    console.error("× 헤더 행을 찾지 못했습니다. 엑셀 첫 행을 확인하세요.");
    console.error("  첫 5행:", JSON.stringify(rows.slice(0, 5), null, 2));
    process.exit(1);
  }
  console.log(`✓ 헤더 행 ${headerIdx + 1}: ${columns.join(" | ")}`);

  // 컬럼 인덱스 추출
  function findCol(...keywords) {
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      for (const kw of keywords) {
        if (c.includes(kw)) return i;
      }
    }
    return -1;
  }
  const cGu     = findCol("자치구", "구");
  const cCat    = findCol("카테고리", "분류", "유형");
  const cName   = findCol("장소명", "AREA_NM", "권역명", "지역명");
  const cCode   = findCol("AREA_CD", "장소코드", "코드");
  const cLat    = findCol("위도", "lat", "LAT", "y", "Y");
  const cLng    = findCol("경도", "lng", "LNG", "x", "X");

  console.log(`  컬럼 매핑: 자치구=${cGu} 카테고리=${cCat} 장소명=${cName} 코드=${cCode} 위도=${cLat} 경도=${cLng}`);

  const records = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[cName]);
    if (!name) continue;
    records.push({
      name,
      code: cCode >= 0 ? clean(r[cCode]) : null,
      gu:   cGu >= 0 ? clean(r[cGu]) : null,
      category: cCat >= 0 ? clean(r[cCat]) : null,
      lat: cLat >= 0 ? toNum(r[cLat]) : null,
      lng: cLng >= 0 ? toNum(r[cLng]) : null,
    });
  }

  console.log(`\n✓ ${records.length}개 권역 파싱`);
  console.log(`  좌표 보유: ${records.filter((r) => r.lat != null && r.lng != null).length}개`);

  // 좌표가 없으면 카카오 API로 보강
  if (KAKAO_KEY && records.some((r) => r.lat == null)) {
    console.log(`\n🔄 카카오 API로 권역 좌표 보강 중...`);
    let success = 0;
    for (const r of records) {
      if (r.lat != null && r.lng != null) continue;
      const coord = await geocodeKakao(r.name);
      if (coord) {
        r.lat = coord.lat;
        r.lng = coord.lng;
        r.gu = coord.gu ?? r.gu;
        success++;
      } else {
        console.warn(`  × 매칭 실패: ${r.name}`);
      }
      // rate limit 보호
      await new Promise((s) => setTimeout(s, 80));
    }
    console.log(`  ✓ ${success}/${records.length}개 좌표 추가`);
  } else if (!KAKAO_KEY) {
    console.warn("\n⚠ KAKAO_REST_API_KEY 미설정 → 좌표 보강 생략 (점포 매칭 불가)");
  }

  console.log(`  자치구 분포:`,
    records.reduce((acc, r) => { if (r.gu) acc[r.gu] = (acc[r.gu] ?? 0) + 1; return acc; }, {}));

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    source: "서울 열린데이터광장 - 실시간 도시데이터 121장소 목록",
    importedAt: new Date().toISOString(),
    count: records.length,
    records,
  }, null, 2), "utf8");
  console.log(`\n✓ ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
