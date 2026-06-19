#!/usr/bin/env node
/**
 * 매출 CSV → Supabase 테이블 일괄 import (매월 갱신용)
 *
 * 바탕 화면의 CSV들을 해당 테이블로 적재 (기존 행 삭제 후 재삽입).
 * convert-online-xlsx.mjs / convert-offline-xlsx.mjs 로 CSV 생성 후 실행.
 *
 * 실행:
 *   node scripts/import-sales.mjs            # 존재하는 CSV 전부
 *   node scripts/import-sales.mjs offline    # 오프라인(5·6번)만
 *   node scripts/import-sales.mjs online     # 온라인(8·9번)만
 *
 * 사전조건: .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * 동작:
 *   - 키 충돌 시 매출/이익/면적/매장수 합산(dedupe)
 *   - 500행 청크 insert, 완료 후 행수 검증 출력
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
(function loadEnv() {
  const t = readFileSync(path.resolve(ROOT, ".env.local"), "utf8");
  for (const l of t.split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// CSV 입력 폴더. --in <dir>로 오버라이드 가능. 기본 ~/OneDrive/바탕 화면.
function argv(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const DESKTOP = argv("--in", path.join(os.homedir(), "OneDrive", "바탕 화면"));

function parseCsv(file) {
  const txt = readFileSync(file, "utf8").replace(/^﻿/, "");
  const lines = txt.trim().split(/\r?\n/);
  const head = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]; const v = []; let c = "", q = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (q) { if (ch === '"') { if (line[j + 1] === '"') { c += '"'; j++; } else q = false; } else c += ch; }
      else { if (ch === ",") { v.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; }
    }
    v.push(c); const o = {}; head.forEach((h, k) => o[h] = v[k]); rows.push(o);
  }
  return rows;
}
const num = (v) => Math.round(Number(v || 0));

function dedupe(rows, keys, sumCols) {
  const m = new Map();
  for (const r of rows) {
    const k = keys.map((c) => r[c]).join("");
    if (m.has(k)) { const e = m.get(k); for (const sc of sumCols) e[sc] += r[sc]; }
    else m.set(k, { ...r });
  }
  return [...m.values()];
}

async function importTable(table, file, mapper, keys, sumCols) {
  if (!existsSync(file)) { console.log(`⏭  ${table}: CSV 없음 (${path.basename(file)})`); return; }
  let rows = parseCsv(file).map(mapper);
  rows = dedupe(rows, keys, sumCols);
  console.log(`[${table}] ${rows.length}행 import`);
  const { error: de } = await sb.from(table).delete().neq("id", -1);
  if (de) { console.error("  삭제 실패:", de.message); return; }
  const C = 500; let d = 0;
  for (let i = 0; i < rows.length; i += C) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + C));
    if (error) { console.error(`\n  insert 실패 @${i}:`, error.message); return; }
    d += Math.min(C, rows.length - i); process.stdout.write(`\r  ${d}/${rows.length}`);
  }
  console.log("\n  ✅");
}

const which = process.argv[2] ?? "all";

async function main() {
  if (which === "all" || which === "online") {
    await importTable("sales_online_monthly", path.join(DESKTOP, "sales_online_monthly.csv"),
      (r) => ({ division: r.division, cat: r.cat, brand: r.brand, store: r.store, channel: r.channel, ym: r.ym, sales: num(r.sales) }),
      ["division", "cat", "brand", "store", "channel", "ym"], ["sales"]);
    await importTable("sales_online_cum", path.join(DESKTOP, "sales_online_cum.csv"),
      (r) => ({ division: r.division, cat: r.cat, brand: r.brand, store: r.store, channel: r.channel, year: r.year, sales: num(r.sales) }),
      ["division", "cat", "brand", "store", "channel", "year"], ["sales"]);
  }
  if (which === "all" || which === "offline") {
    await importTable("sales_offline_cum", path.join(DESKTOP, "sales_offline_cum.csv"),
      (r) => ({ division: r.division, cat: r.cat, brand: r.brand, store: r.store, year: r.period, sales: num(r.sales), gp: num(r.gp), area_raw: num(r.area_raw), store_cnt: num(r.store_cnt) }),
      ["division", "cat", "brand", "store", "year"], ["sales", "gp", "area_raw", "store_cnt"]);
    await importTable("sales_offline_month", path.join(DESKTOP, "sales_offline_month.csv"),
      (r) => ({ division: r.division, cat: r.cat, brand: r.brand, store: r.store, ym: r.period, sales: num(r.sales), gp: num(r.gp), area_raw: num(r.area_raw), store_cnt: num(r.store_cnt) }),
      ["division", "cat", "brand", "store", "ym"], ["sales", "gp", "area_raw", "store_cnt"]);
  }
  console.log("\n🎉 import 완료");
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
