 
// 데스크톱 CSV(공실4월3주.CSV)를 src/data/vacancy.json 으로 변환.
//
// 사용:  node scripts/import-vacancy.mjs
//        node scripts/import-vacancy.mjs <CSV 경로>
//
// CSV는 CP949(EUC-KR) 인코딩이며 헤더가 5행에 걸쳐 머지되어 있어
// xlsx 파서로 raw 셀 배열을 받아 후처리한다.

import XLSX from "xlsx";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SRC = resolve(homedir(), "Desktop", "공실4월3주.CSV");
const SRC = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SRC;
const OUT = resolve(__dirname, "..", "src", "data", "vacancy.json");

// CP949 → UTF-8 (Node 18+ TextDecoder가 euc-kr/cp949 지원)
function readCp949(path) {
  const buf = readFileSync(path);
  // BOM이 없는 한글 CSV는 cp949일 가능성이 높음. 단, 이미 UTF-8이면 자동 폴백.
  // 1) UTF-8 디코딩 후 한글 깨짐 휴리스틱(치환문자 비율)으로 판별 → 깨졌으면 cp949 재시도.
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const replacementRatio = (utf8.match(/�/g) ?? []).length / Math.max(utf8.length, 1);
  if (replacementRatio < 0.001 && /[가-힣]/.test(utf8)) return utf8;
  return new TextDecoder("euc-kr").decode(buf);
}

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" || s === "-" ? null : s;
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// 진척사항 정규화: "4단계", "3단계 " → "4단계"; 그 외는 그대로
function normalizeStage(raw) {
  const v = clean(raw);
  if (!v) return null;
  const m = v.match(/^([1-5])\s*단계/);
  return m ? `${m[1]}단계` : v;
}

// 담당 카테고리 정규화: 공백 제거. 오타("리징"도 그대로 유지 — 사용자 요청 사항)
function normalizeCategory(raw) {
  const v = clean(raw);
  if (!v) return null;
  return v.replace(/\([^)]*\)/g, "").trim();
}

function main() {
  const text = readCp949(SRC);
  const wb = XLSX.read(text, { type: "string", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // 헤더 분석 결과 (CSV 6행 기준 — 0-indexed로 5):
  //   0:영업본부 1:지점 2:층 3:패션 4:비패션 5:외식
  //   6:기존 브랜드 7:대안 1안 8:대안 2안
  //   9:면적(PY) 10:담당 카테고리 11:진척사항 12:비고
  //   13:월예상매출 14:매총율 15:월관리비 16:매총이익
  //   17:해결사 18:MD 의견 19:시점
  //
  // 데이터 시작 — "영업N본부" 패턴이 0번 컬럼에 처음 등장하는 행부터.
  let startIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][0];
    if (typeof v === "string" && /^영업\d+본부/.test(v.trim())) { startIdx = i; break; }
  }
  if (startIdx < 0) throw new Error("데이터 시작 행을 찾지 못했습니다.");

  const records = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    const branch = clean(r[1]);
    if (!branch) continue;

    const segments = [];
    if (clean(r[3])) segments.push("패션");
    if (clean(r[4])) segments.push("비패션");
    if (clean(r[5])) segments.push("외식");

    const alt1 = clean(r[7]);
    const alt2 = clean(r[8]);
    const alts = [alt1, alt2].filter(Boolean);

    const stage = normalizeStage(r[11]);
    const category = normalizeCategory(r[10]);

    records.push({
      headquarters: clean(r[0]),
      branch,
      floor: clean(r[2]),
      segments,
      currentBrand: clean(r[6]),
      altBrands: alts,
      areaPy: num(r[9]),
      category,            // 담당 카테고리
      stage,               // 진척사항
      note: clean(r[12]),  // 비고
      mdOpinion: clean(r[18]),
    });
  }

  // KPI: 담당 카테고리 ∈ {리징, 리빙} AND 진척사항 ∈ {3단계, 4단계}
  const KPI_CATEGORIES = new Set(["리징", "리빙"]);
  const KPI_STAGES = new Set(["3단계", "4단계"]);
  const resolvedCount = records.filter(
    (r) => r.category && r.stage && KPI_CATEGORIES.has(r.category) && KPI_STAGES.has(r.stage),
  ).length;

  // 요약(콘솔 — 검증용)
  const byStage = {};
  const byCategory = {};
  for (const r of records) {
    if (r.stage) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
    if (r.category) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  const payload = {
    source: "공실4월3주.CSV",
    importedAt: new Date().toISOString(),
    count: records.length,
    resolvedCount,
    records,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");

  console.log(`✓ ${records.length}건 변환 → ${OUT}`);
  console.log(`  진척사항:`, byStage);
  console.log(`  담당 카테고리:`, byCategory);
  console.log(`  공실해결(리징·리빙 × 3·4단계):`, resolvedCount);
}

main();
