 
// 데스크톱 CSV(💫이랜드리테일 콘텐츠팝업팀 - 팝업 컨텍판.csv)를
// src/data/popup-contacts.json 으로 정규화 변환.
//
// 사용:  node scripts/import-popup-contacts.mjs
//
// CSV 첫 4행은 머지된 헤더이고, 셀 안에 개행이 들어있어 xlsx로 안전하게 파싱.

import XLSX from "xlsx";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(homedir(), "Desktop", "💫이랜드리테일 콘텐츠팝업팀 - 팝업 컨텍판.csv");
const OUT = resolve(__dirname, "..", "src", "data", "popup-contacts.json");

// 진행단계 정규화: "5.컨택포인트 확보 및 제안" → "컨택포인트 확보"
const STAGE_MAP = [
  { match: /확정/,                     normalized: "확정" },
  { match: /조건\s*협의/,                normalized: "조건 협의" },
  { match: /미팅/,                      normalized: "미팅 예정" },
  { match: /(컨택|콜드메일|유선)/,        normalized: "컨택포인트 확보" },
];

function normalizeStage(raw) {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v || v === "미확보") return "미확보";
  for (const { match, normalized } of STAGE_MAP) {
    if (match.test(v)) return normalized;
  }
  return v;
}

function normalizeField(raw) {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  // "패션(잡화포함)" → "패션", "리빙(라이프)" → "리빙"
  return v.replace(/\([^)]*\)/g, "").trim();
}

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
}

function main() {
  // CSV는 UTF-8(BOM 가능). xlsx readFile은 기본 cp1252로 해석하므로 buffer로 직접 읽어 utf8 string 변환.
  let csv = readFileSync(SRC, "utf8");
  if (csv.charCodeAt(0) === 0xfeff) csv = csv.slice(1); // BOM 제거
  const wb = XLSX.read(csv, { type: "string", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // 데이터 시작 행 찾기 — 1번째 컬럼이 숫자(인하우스 No)인 첫 행부터
  let startIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i][0];
    if (typeof v === "number" && v >= 1) { startIdx = i; break; }
    if (typeof v === "string" && /^\d+$/.test(v.trim())) { startIdx = i; break; }
  }
  if (startIdx < 0) throw new Error("데이터 시작 행을 찾지 못했습니다.");

  const dataRows = rows.slice(startIdx);

  const records = [];
  for (const r of dataRows) {
    // 컬럼 인덱스 (헤더 분석 결과)
    // 0:인하우스(번호) 1:업계 2:업체명 3:브랜드명 4:1페지 5:담당자
    // 6:분야 7:BCD 8:성함 9:연락처 10:메일주소 11:진행단계
    // 12:레퍼런스 13:희망 입점명 14:입점 위치 15:진행일 16:신규담당자
    const noVal = r[0];
    const no = typeof noVal === "number" ? noVal : Number(String(noVal).trim());
    if (!Number.isFinite(no) || no < 1) continue;

    const company = clean(r[2]);
    const brand   = clean(r[3]);
    if (!company && !brand) continue; // 빈 행 컷

    records.push({
      no,
      industry:    clean(r[1]),
      company:     company,
      brand:       brand ?? company,
      isFirstPage: clean(r[4]) === "O",
      manager:     clean(r[5]),
      field:       normalizeField(r[6]),
      grade:       clean(r[7]),
      contactName: clean(r[8]),
      phone:       clean(r[9]),
      email:       clean(r[10]),
      stage:       normalizeStage(clean(r[11])),
      reference:   clean(r[12]),
      hopeStore:   clean(r[13]),
      hopeLoc:     clean(r[14]),
      progressAt:  clean(r[15]),
      newManager:  clean(r[16]),
    });
  }

  records.sort((a, b) => a.no - b.no);

  mkdirSync(dirname(OUT), { recursive: true });
  const payload = {
    source: "💫이랜드리테일 콘텐츠팝업팀 - 팝업 컨텍판.csv",
    importedAt: new Date().toISOString(),
    count: records.length,
    records,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");

  // 요약
  const byField  = {};
  const byStage  = {};
  const byGrade  = {};
  for (const x of records) {
    if (x.field) byField[x.field] = (byField[x.field] ?? 0) + 1;
    if (x.stage) byStage[x.stage] = (byStage[x.stage] ?? 0) + 1;
    if (x.grade) byGrade[x.grade] = (byGrade[x.grade] ?? 0) + 1;
  }
  console.log(`✓ ${records.length}건 변환 → ${OUT}`);
  console.log(`  분야:`, byField);
  console.log(`  단계:`, byStage);
  console.log(`  등급:`, byGrade);
}

main();
