#!/usr/bin/env node
/**
 * 계약 마스터 업로드 — 로컬 TSV → Supabase tenant_contracts.
 *
 *   node scripts/upload-tenant-contracts.mjs           # 실제 업로드
 *   node scripts/upload-tenant-contracts.mjs --dry     # 파싱만 (DB write 안 함)
 *
 * 전략: DELETE all → INSERT all. ERP 스냅샷을 절대 진리로 취급.
 * 앱에서는 이 테이블을 편집하지 않는다 (RLS write 정책 없음).
 *
 * 사전조건: .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * 파싱 규칙은 src/lib/tenantContracts.ts 와 완전히 동일해야 한다 —
 * 변경 시 verify-tenant-contracts.mjs 결과와 대조해서 카운트가 일치하는지 확인.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACTDATA_DIR = path.join(ROOT, "contractdata");
const DRY = process.argv.includes("--dry");

// ── .env.local 로드 ──────────────────────────────────────────
(function loadEnv() {
  const t = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
  for (const l of t.split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

// ── 파싱 로직 (src/lib/tenantContracts.ts 와 동일) ───────────
const CONTRACT_TYPES = new Set([
  "임대갑",
  "임대을",
  "임대갑(단기)",
  "임대을(단기)",
  "판매분특정",
  "판매분특정(단기)",
]);
const RENEWAL_KEYWORDS = [
  "자동연장", "재계약", "중도퇴점", "퇴점", "종료", "연장",
  "신규", "갱신", "만료", "휴점", "오픈", "검토중",
  "3개월", "6개월", "1개월", "2개월",
];
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_BIZ = /^\d{10}$/;
const RE_CONTRACT_NUM = /^\d{14}$/;
const RE_PHONE = /^(01\d-?\d{3,4}-?\d{4}|0\d{1,2}-\d{3,4}-\d{4}|\d{10,11})$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PLANT = /^\d{4}$/;

function splitLogicalRows(text) {
  const rows = [];
  let cur = "";
  let inQuote = false;
  for (const ch of text) {
    if (ch === '"') { inQuote = !inQuote; cur += ch; }
    else if (ch === "\n" && !inQuote) { rows.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur) rows.push(cur);
  return rows;
}

function splitFields(row) {
  return row.split(/ {2,}/).map((f) => f.trim().replace(/^"+|"+$/g, "").trim()).filter(Boolean);
}

function pickRenewalStatus(fields, afterIndex) {
  for (let i = afterIndex; i < Math.min(fields.length, afterIndex + 6); i++) {
    const f = fields[i];
    for (const kw of RENEWAL_KEYWORDS) if (f.includes(kw)) return f;
  }
  return null;
}

function parseRow(fields) {
  if (fields.length < 8) return null;
  const plantCode = fields[0];
  if (!RE_PLANT.test(plantCode)) return null;
  const storeName = fields[1];
  const contractType = fields[2];
  if (!CONTRACT_TYPES.has(contractType)) return null;

  const floor = fields[3] ?? null;
  const purchaseGroup = fields[4] ?? null;
  const purchaseCode = fields[5] ?? null;
  const purchaseName = fields[6] ?? null;
  const brand = fields[7] ?? "";
  const representative = fields[8] ?? null;

  const dateIndices = [];
  let bizIndex = -1, contractNumIndex = -1, emailIndex = -1, phoneIndex = -1;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (RE_DATE.test(f)) dateIndices.push(i);
    else if (bizIndex < 0 && RE_BIZ.test(f)) bizIndex = i;
    else if (contractNumIndex < 0 && RE_CONTRACT_NUM.test(f)) contractNumIndex = i;
    else if (emailIndex < 0 && RE_EMAIL.test(f)) emailIndex = i;
    else if (phoneIndex < 0 && RE_PHONE.test(f.replace(/\s/g, ""))) phoneIndex = i;
  }

  const firstContractDate = dateIndices[0] != null ? fields[dateIndices[0]] : null;
  const contractStartDate = dateIndices[1] != null ? fields[dateIndices[1]] : null;
  const contractEndDate   = dateIndices[2] != null ? fields[dateIndices[2]] : null;

  let renewalStatus = null;
  if (dateIndices[2] != null) {
    renewalStatus = pickRenewalStatus(fields, dateIndices[2] + 1);
  }

  let contactPerson = null;
  if (phoneIndex > 0 || emailIndex > 0) {
    const anchor = phoneIndex > 0 ? phoneIndex : emailIndex;
    for (let i = anchor - 1; i >= Math.max(0, anchor - 3); i--) {
      const f = fields[i];
      if (/^[가-힣]{2,5}$/.test(f)) { contactPerson = f; break; }
    }
  }

  return {
    plant_code: plantCode,
    store_name: storeName,
    contract_type: contractType,
    floor,
    purchase_group: purchaseGroup,
    purchase_code: purchaseCode,
    purchase_name: purchaseName,
    brand,
    representative,
    first_contract_date: firstContractDate,
    contract_start_date: contractStartDate,
    contract_end_date: contractEndDate,
    renewal_status: renewalStatus,
    business_id: bizIndex >= 0 ? fields[bizIndex] : null,
    contract_number: contractNumIndex >= 0 ? fields[contractNumIndex] : null,
    md: null,
    store_manager: null,
    contact_person: contactPerson,
    phone: phoneIndex >= 0 ? fields[phoneIndex] : null,
    email: emailIndex >= 0 ? fields[emailIndex] : null,
  };
}

// ── 최신 TSV 찾기 ────────────────────────────────────────────
function findLatestTsv() {
  const entries = readdirSync(CONTRACTDATA_DIR);
  const candidates = entries
    .filter((f) => /^tenant-contracts-master-.*\.tsv$/i.test(f))
    .map((f) => {
      const full = path.join(CONTRACTDATA_DIR, f);
      return { file: full, name: f, mtimeMs: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] ?? null;
}

// ── 메인 ─────────────────────────────────────────────────────
const found = findLatestTsv();
if (!found) {
  console.error("❌ contractdata/tenant-contracts-master-*.tsv 가 없습니다.");
  process.exit(1);
}
console.log(`📄 source: ${found.name}`);

const text = readFileSync(found.file, "utf-8");
const rows = splitLogicalRows(text);
const contracts = [];
let skipped = 0;
for (let i = 1; i < rows.length; i++) {
  const line = rows[i].trim();
  if (!line || line.startsWith("#N/A")) { skipped++; continue; }
  const rec = parseRow(splitFields(line));
  if (rec) {
    rec.source = found.name;
    contracts.push(rec);
  } else {
    skipped++;
  }
}
console.log(`✓ parsed: ${contracts.length}건 (skipped: ${skipped})`);

// 통계 요약
const byType = {};
for (const c of contracts) byType[c.contract_type] = (byType[c.contract_type] ?? 0) + 1;
console.log("  계약형태:", byType);
const stores = new Set(contracts.map((c) => c.store_name));
console.log(`  지점: ${stores.size}개`);

if (DRY) {
  console.log("\n🔍 --dry 모드: DB write 스킵.");
  process.exit(0);
}

// ── Supabase 업로드 ──────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log("\n🧹 기존 tenant_contracts 전체 삭제 중...");
const { error: delErr, count: delCount } = await supabase
  .from("tenant_contracts")
  .delete({ count: "exact" })
  .not("id", "is", null);   // 모든 행 매치용 트루 프레디케이트
if (delErr) {
  console.error("❌ DELETE 실패:", delErr.message);
  process.exit(1);
}
console.log(`  삭제: ${delCount ?? 0}건`);

console.log(`\n📤 INSERT ${contracts.length}건 (배치 200)...`);
const BATCH = 200;
let inserted = 0;
for (let i = 0; i < contracts.length; i += BATCH) {
  const slice = contracts.slice(i, i + BATCH);
  const { error, count } = await supabase
    .from("tenant_contracts")
    .insert(slice, { count: "exact" });
  if (error) {
    console.error(`❌ INSERT 배치 ${i}~${i + slice.length}:`, error.message);
    process.exit(1);
  }
  inserted += count ?? slice.length;
  process.stdout.write(`  ${inserted}/${contracts.length}\r`);
}
console.log(`\n✅ 완료: ${inserted}건 업로드`);
