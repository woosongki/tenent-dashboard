#!/usr/bin/env node
// contractdata/*.tsv 을 tenantContracts.ts 파서와 동일한 룰로 파싱해서
// 커버리지·앵커 매칭 통계를 확인. UI 전에 데이터 정합성 눈으로 검증.

import fs from "node:fs";
import path from "node:path";

const CONTRACTDATA_DIR = path.resolve("contractdata");

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

function pickRenewal(fields, start) {
  for (let i = start; i < Math.min(fields.length, start + 6); i++) {
    const f = fields[i];
    for (const kw of RENEWAL_KEYWORDS) if (f.includes(kw)) return f;
  }
  return null;
}

const files = fs.readdirSync(CONTRACTDATA_DIR).filter((f) => /^tenant-contracts-master-.*\.tsv$/.test(f));
if (!files.length) { console.error("no tenant-contracts-master-*.tsv"); process.exit(1); }
const file = path.join(CONTRACTDATA_DIR, files.sort().reverse()[0]);
console.log("source:", file);
const text = fs.readFileSync(file, "utf-8");
const rows = splitLogicalRows(text);
console.log(`logical rows: ${rows.length}`);

let ok = 0, skipped = 0;
const stores = new Map();
const ctypes = new Map();
const withEnd = { withRenewal: 0, withoutRenewal: 0 };
const withBiz = { yes: 0, no: 0 };
const expiringSoon = [];
const today = new Date(); today.setHours(0,0,0,0);
const in60 = new Date(today); in60.setDate(in60.getDate() + 60);

for (let i = 1; i < rows.length; i++) {
  const line = rows[i].trim();
  if (!line || line.startsWith("#N/A")) { skipped++; continue; }
  const f = splitFields(line);
  if (f.length < 8) { skipped++; continue; }
  if (!RE_PLANT.test(f[0])) { skipped++; continue; }
  if (!CONTRACT_TYPES.has(f[2])) { skipped++; continue; }
  ok++;
  stores.set(f[1], (stores.get(f[1]) ?? 0) + 1);
  ctypes.set(f[2], (ctypes.get(f[2]) ?? 0) + 1);
  const dates = [];
  let biz = null, cnum = null, email = null;
  for (const x of f) {
    if (RE_DATE.test(x)) dates.push(x);
    else if (!biz && RE_BIZ.test(x)) biz = x;
    else if (!cnum && RE_CONTRACT_NUM.test(x)) cnum = x;
    else if (!email && RE_EMAIL.test(x)) email = x;
  }
  const endDate = dates[2] ?? null;
  const renewal = endDate ? pickRenewal(f, f.indexOf(dates[2]) + 1) : null;
  if (endDate) { renewal ? withEnd.withRenewal++ : withEnd.withoutRenewal++; }
  biz ? withBiz.yes++ : withBiz.no++;

  if (endDate) {
    const end = new Date(endDate + "T00:00:00");
    if (end >= today && end <= in60) {
      const settled = renewal && ["종료","퇴점","중도퇴점","자동연장","재계약"].some((m) => renewal.includes(m));
      if (!settled) expiringSoon.push({ store: f[1], brand: f[7], ctype: f[2], endDate, renewal });
    }
  }
}
console.log(`\nparse ok: ${ok}, skipped: ${skipped}`);
console.log(`unique stores: ${stores.size}`);
console.log("contract types:", Object.fromEntries(ctypes));
console.log("end date + 갱신 상태:", withEnd);
console.log("사업자번호:", withBiz);
console.log(`\n만료 D-60 이내 (settled 제외): ${expiringSoon.length}건`);
console.log("샘플 10건:");
expiringSoon.slice(0, 10).forEach((r) => {
  const days = Math.ceil((new Date(r.endDate + "T00:00:00") - today) / (1000 * 60 * 60 * 24));
  console.log(`  D-${String(days).padStart(3, " ")}  ${r.endDate}  ${r.store.padEnd(8)}  ${r.ctype.padEnd(14)}  ${r.brand}  [${r.renewal ?? "미결정"}]`);
});
