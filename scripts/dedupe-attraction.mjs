#!/usr/bin/env node
/**
 * attraction_status 중복 정리 스크립트.
 *
 * 두 종류의 중복을 모두 찾는다:
 *   1) notion_url 동일  — 기존 sync 로직의 1차 dedupe와 동일
 *   2) brand_name + branch 동일 (느슨한 키)
 *      — "진행중 → 완료"로 상태가 바뀌었거나 층/카테고리가 다르게 기재된
 *        같은 브랜드 페이지를 하나로 본다.
 *
 * winner 선정 우선순위:
 *   - is_completed=true 우선 (완료 정보가 캐노니컬)
 *   - notion_url 있는 행 > 없는 행 (수동 입력보다 노션 sync 결과 보존)
 *   - 채워진 필드 수가 많은 행 > 적은 행
 *   - 더 오래된 created_at
 *
 * 실행:
 *   node scripts/dedupe-attraction.mjs            # dry-run (삭제 안 함)
 *   node scripts/dedupe-attraction.mjs --apply    # 실제 삭제
 *
 * 사전조건: .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "node:fs";
import path from "node:path";
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

const APPLY = process.argv.includes("--apply");
const TABLE = "attraction_status";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function loadAll() {
  const all = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

function score(r) {
  let s = 0;
  for (const k of ["brand_name", "branch", "floor", "category", "size_pyeong", "manager", "memo", "notion_url"]) {
    const v = r[k];
    if (v != null && v !== "") s++;
  }
  return s;
}

function pickWinner(rows) {
  return [...rows].sort((a, b) => {
    const ac = a.is_completed ? 1 : 0;
    const bc = b.is_completed ? 1 : 0;
    if (ac !== bc) return bc - ac;
    const au = a.notion_url ? 1 : 0;
    const bu = b.notion_url ? 1 : 0;
    if (au !== bu) return bu - au;
    const sa = score(a), sb = score(b);
    if (sa !== sb) return sb - sa;
    return new Date(a.created_at) - new Date(b.created_at);
  })[0];
}

const norm = (v) => (v ?? "").toString().trim().toLowerCase();
const brandKey = (r) => `${norm(r.brand_name)}|${norm(r.branch)}`;

async function main() {
  console.log(`📋 ${TABLE} dedupe — ${APPLY ? "APPLY 모드 (삭제 수행)" : "DRY-RUN (확인만)"}`);
  const rows = await loadAll();
  console.log(`   총 ${rows.length}행 로드`);

  const toDelete = new Map();
  const reasonOf = new Map();

  // 1단계: notion_url 그룹
  const urlGroups = new Map();
  for (const r of rows) {
    if (!r.notion_url) continue;
    const arr = urlGroups.get(r.notion_url) ?? [];
    arr.push(r);
    urlGroups.set(r.notion_url, arr);
  }
  let urlDupGroups = 0;
  for (const [url, arr] of urlGroups) {
    if (arr.length < 2) continue;
    urlDupGroups++;
    const winner = pickWinner(arr);
    for (const r of arr) {
      if (r.id !== winner.id) {
        toDelete.set(r.id, r);
        reasonOf.set(r.id, `notion_url=${url.slice(0, 60)}…`);
      }
    }
  }

  // 2단계: 브랜드 키 그룹 (1단계 삭제 대상 제외)
  const remaining = rows.filter((r) => !toDelete.has(r.id));
  const brandGroups = new Map();
  for (const r of remaining) {
    if (!r.brand_name) continue;
    const k = brandKey(r);
    const arr = brandGroups.get(k) ?? [];
    arr.push(r);
    brandGroups.set(k, arr);
  }
  const brandDupSamples = [];
  let brandDupGroups = 0;
  for (const [, arr] of brandGroups) {
    if (arr.length < 2) continue;
    brandDupGroups++;
    const winner = pickWinner(arr);
    if (brandDupSamples.length < 20) brandDupSamples.push({ winner, arr });
    for (const r of arr) {
      if (r.id !== winner.id) {
        toDelete.set(r.id, r);
        reasonOf.set(r.id, `brand_key`);
      }
    }
  }

  console.log(`\n   notion_url 중복 그룹: ${urlDupGroups}개`);
  console.log(`   브랜드 키(브랜드+지점) 중복 그룹: ${brandDupGroups}개`);
  console.log(`   삭제 대상 행: ${toDelete.size}개`);

  if (toDelete.size === 0) {
    console.log("\n✨ 중복 없음 — 정상 상태");
    return;
  }

  if (brandDupSamples.length > 0) {
    console.log(`\n🔍 브랜드 키 중복 그룹 샘플 (최대 ${brandDupSamples.length}그룹):`);
    for (const { winner, arr } of brandDupSamples) {
      console.log(`   • [${winner.brand_name}] ${winner.branch ?? "-"}`);
      for (const r of arr) {
        const tag = r.id === winner.id ? "✔ KEEP " : "✘ DROP ";
        const done = r.is_completed ? "완료" : "진행중";
        console.log(`      ${tag} 층=${r.floor ?? "-"} 카테고리=${r.category ?? "-"} (${done}) id=${r.id.slice(0, 8)}`);
      }
    }
  }

  const sample = [...toDelete.values()].slice(0, 20);
  console.log(`\n📌 전체 삭제 대상 샘플 (최대 ${sample.length}건):`);
  for (const r of sample) {
    console.log(`   - [${r.brand_name}] 지점=${r.branch ?? "-"} 층=${r.floor ?? "-"} 카테고리=${r.category ?? "-"} (${r.is_completed ? "완료" : "진행중"}) (${reasonOf.get(r.id)})`);
  }

  if (!APPLY) {
    console.log("\n💡 실제로 삭제하려면 --apply 플래그를 추가하세요.");
    return;
  }

  const ids = [...toDelete.keys()];
  const CHUNK = 200;
  let d = 0;
  for (let k = 0; k < ids.length; k += CHUNK) {
    const slice = ids.slice(k, k + CHUNK);
    const { error } = await sb.from(TABLE).delete().in("id", slice);
    if (error) { console.error("\n❌ 삭제 오류:", error.message); return; }
    d += slice.length;
    process.stdout.write(`\r   삭제 진행 ${d}/${ids.length}`);
  }
  console.log("\n✅ 완료");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
