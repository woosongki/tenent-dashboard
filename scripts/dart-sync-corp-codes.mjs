#!/usr/bin/env node
/**
 * DART에서 전체 법인코드 목록을 다운로드하여 JSON으로 캐시합니다.
 * 실행: node scripts/dart-sync-corp-codes.mjs
 * 출력: src/data/dart/corp-codes.json
 */

import { config } from "dotenv";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

config({ path: ".env.local", override: true });

const DART_KEY = process.env.DART_API_KEY;
if (!DART_KEY) {
  console.error("❌ DART_API_KEY가 .env.local에 없습니다");
  process.exit(1);
}

const OUTPUT_DIR = join(process.cwd(), "src", "data", "dart");
const OUTPUT_FILE = join(OUTPUT_DIR, "corp-codes.json");

async function downloadZip() {
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_KEY}`;
  console.log("📥 DART 법인코드 ZIP 다운로드 중...");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DART 응답 오류: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

function parseXml(xml) {
  const corps = [];
  // DART XML: <list>...<corp_code>X</corp_code>...<corp_name>Y</corp_name>...<stock_code>Z</stock_code>...</list>
  // 멀티라인 + 들여쓰기 허용
  const re = /<list>\s*<corp_code>(\d+)<\/corp_code>\s*<corp_name>([^<]+)<\/corp_name>(?:\s*<corp_eng_name>[^<]*<\/corp_eng_name>)?\s*<stock_code>([^<]*)<\/stock_code>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    corps.push({
      code: match[1],
      name: decodeEntities(match[2].trim()),
      stockCode: match[3].trim(),
    });
  }
  return corps;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// zlib workaround for ESM
async function inflate(compressedData) {
  const zlib = await import("zlib");
  return new Promise((resolve, reject) => {
    zlib.inflateRaw(compressedData, (err, buf) => {
      if (err) reject(err);
      else resolve(buf.toString("utf-8"));
    });
  });
}

async function main() {
  const zipBuffer = await downloadZip();
  console.log(`   다운로드 완료: ${(zipBuffer.length / 1024).toFixed(0)} KB`);

  console.log("📦 ZIP 파싱 중...");
  const sig = zipBuffer.readUInt32LE(0);
  if (sig !== 0x04034b50) throw new Error("올바른 ZIP 파일이 아닙니다");

  const compression = zipBuffer.readUInt16LE(8);
  const generalPurposeFlag = zipBuffer.readUInt16LE(6);
  let compressedSize = zipBuffer.readUInt32LE(18);
  const fnLen = zipBuffer.readUInt16LE(26);
  const extraLen = zipBuffer.readUInt16LE(28);
  const dataOffset = 30 + fnLen + extraLen;

  // 데이터 디스크립터를 쓰는 경우(bit 3 set) 또는 사이즈가 0이면
  // 파일 끝의 central directory(0x02014b50)부터 역추적
  if ((generalPurposeFlag & 0x08) || compressedSize === 0) {
    // central directory signature 위치 찾기
    let cdrOffset = -1;
    for (let i = dataOffset; i < zipBuffer.length - 4; i++) {
      if (zipBuffer.readUInt32LE(i) === 0x02014b50) {
        cdrOffset = i;
        break;
      }
    }
    if (cdrOffset === -1) throw new Error("central directory를 찾을 수 없음");
    // local file header 직후부터 cdrOffset 직전까지가 압축 데이터
    // (data descriptor가 있으면 16바이트 트레일러가 포함되어 있을 수 있으나
    //  inflateRaw는 압축 스트림 끝에서 자동 정지)
    compressedSize = cdrOffset - dataOffset;
  }
  const compressedData = zipBuffer.slice(dataOffset, dataOffset + compressedSize);

  let xml;
  if (compression === 0) {
    xml = compressedData.toString("utf-8");
  } else if (compression === 8) {
    xml = await inflate(compressedData);
  } else {
    throw new Error(`지원하지 않는 압축 방식: ${compression}`);
  }

  console.log(`   XML 크기: ${(xml.length / 1024).toFixed(0)} KB`);

  console.log("🔍 법인 파싱 중...");
  const corps = parseXml(xml);
  console.log(`   ${corps.length.toLocaleString()}개 법인 파싱 완료`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(corps));
  console.log(`✅ 저장 완료: ${OUTPUT_FILE}`);
  console.log(`   파일 크기: ${(readFileSync(OUTPUT_FILE).length / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error("❌ 오류:", err.message ?? err);
  process.exit(1);
});
