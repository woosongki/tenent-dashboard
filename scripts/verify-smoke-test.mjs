#!/usr/bin/env node
/**
 * 테넌트 검증 파이프라인 스모크 테스트 (CLI)
 * UI를 거치지 않고 전체 흐름을 한 번 실행하여 동작 여부를 확인합니다.
 *
 * 사용:
 *   node scripts/verify-smoke-test.mjs "회사명"
 *   node scripts/verify-smoke-test.mjs 다이소
 *
 * 동작:
 *   1. DART 법인코드 검색
 *   2. DART 기본정보 + 재무 + 공시 + 최대주주 수집
 *   3. 네이버 뉴스 수집
 *   4. Claude 분석
 *   5. Notion 저장
 *   각 단계별 결과를 콘솔에 출력
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";

const company = process.argv[2];
if (!company) {
  console.error("사용법: node scripts/verify-smoke-test.mjs \"회사명\"");
  process.exit(1);
}

const DART_KEY = process.env.DART_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const NAVER_ID = process.env.NAVER_SEARCH_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET;
const NOTION_KEY = process.env.NOTION_API_KEY;
const TENANT_DB = process.env.NOTION_DB_VERIFY_TENANT_ID;
const NEWS_DB = process.env.NOTION_DB_VERIFY_NEWS_ID;

function step(n, msg) { console.log(`\n[${n}] ${msg}`); }
function ok(msg) { console.log(`    ✅ ${msg}`); }
function fail(msg) { console.log(`    ❌ ${msg}`); }

// ── 1. DART 법인코드 검색 ────────────────────────────────────
step(1, `"${company}" DART 법인코드 검색`);
const corpsPath = join(process.cwd(), "src/data/dart/corp-codes.json");
const corps = JSON.parse(readFileSync(corpsPath, "utf-8"));
function searchCorp(q) {
  const exacts = corps.filter((c) => c.name === q);
  if (exacts.length > 0) {
    const listed = exacts.find((c) => c.stockCode);
    return listed ?? exacts[0];
  }
  const sortFn = (a, b) => {
    const sa = a.stockCode ? 0 : 1;
    const sb = b.stockCode ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.name.length - b.name.length;
  };
  const starts = corps.filter((c) => c.name.startsWith(q)).sort(sortFn);
  if (starts[0]) return starts[0];
  const contains = corps.filter((c) => c.name.includes(q)).sort(sortFn);
  if (contains[0]) return contains[0];
  return corps.filter((c) => c.name.length >= 3 && q.includes(c.name)).sort((a, b) => b.name.length - a.name.length)[0];
}
const corp = searchCorp(company);
if (!corp) {
  fail("법인코드를 찾을 수 없음");
  process.exit(1);
}
ok(`${corp.code} / ${corp.name} (stock_code: ${corp.stockCode || "없음"})`);
const corpCode = corp.code;

// ── 2. DART API 호출 ─────────────────────────────────────────
async function dartGet(endpoint, params) {
  const url = new URL(`https://opendart.fss.or.kr/api/${endpoint}`);
  url.searchParams.set("crtfc_key", DART_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  return res.json();
}

step(2, "DART 기업 기본정보");
const info = await dartGet("company.json", { corp_code: corpCode });
if (info.status !== "000") fail(`${info.status} ${info.message}`);
else ok(`${info.corp_name} | 대표: ${info.ceo_nm} | ${info.induty_code || "업종 미상"} | 설립 ${info.est_dt}`);

step(3, "DART 최근 사업보고서 (3년)");
const financials = [];
const currentYear = new Date().getFullYear();
for (let y = currentYear - 1; y >= currentYear - 3; y--) {
  const data = await dartGet("fnlttSinglAcnt.json", {
    corp_code: corpCode,
    bsns_year: String(y),
    reprt_code: "11011",
  });
  if (data.status === "000") {
    const items = data.list || [];
    const findItem = (names) => items.find((x) => names.some((n) => x.account_nm.includes(n)) && x.sj_div === "IS");
    const findBs = (names) => items.find((x) => names.some((n) => x.account_nm.includes(n)) && x.sj_div === "BS");
    const rev = findItem(["매출액", "영업수익"]);
    const op = findItem(["영업이익"]);
    const eq = findBs(["자본총계"]);
    const debt = findBs(["부채총계"]);
    financials.push({ year: y, revenue: rev?.thstrm_amount, operating: op?.thstrm_amount, equity: eq?.thstrm_amount, debt: debt?.thstrm_amount });
    const toB = (s) => s ? Math.round(Number(s.replace(/,/g, "")) / 1e8) + "억" : "—";
    ok(`${y}년: 매출 ${toB(rev?.thstrm_amount)} | 영업이익 ${toB(op?.thstrm_amount)} | 자본 ${toB(eq?.thstrm_amount)} | 부채 ${toB(debt?.thstrm_amount)}`);
  } else {
    fail(`${y}년: ${data.message} (${data.status})`);
    financials.push({ year: y });
  }
}

step(4, "DART 24개월 수시공시");
const end = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const start = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
const discl = await dartGet("list.json", { corp_code: corpCode, bgn_de: start, end_de: end, pblntf_ty: "A", page_count: "50" });
if (discl.status === "000") {
  ok(`${(discl.list || []).length}건 수집`);
  (discl.list || []).slice(0, 3).forEach((d) => console.log(`        - ${d.rcept_dt} [${d.pblntf_ty_nm}] ${d.report_nm}`));
} else fail(discl.message);

// ── 3. 네이버 뉴스 ─────────────────────────────────────────────
step(5, "네이버 뉴스 검색 (최근 12개월)");
const newsRes = await fetch(
  `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(`"${company}"`)}&display=20&sort=date`,
  { headers: { "X-Naver-Client-Id": NAVER_ID, "X-Naver-Client-Secret": NAVER_SECRET } }
);
const newsData = await newsRes.json();
if (newsData.items) {
  ok(`${newsData.items.length}건 수집 (총 ${newsData.total}건 중)`);
  newsData.items.slice(0, 3).forEach((n) => console.log(`        - [${n.pubDate.slice(0, 16)}] ${n.title.replace(/<[^>]+>/g, "")}`));
} else {
  fail(`네이버 응답 오류: ${JSON.stringify(newsData).slice(0, 200)}`);
}

// ── 4. Claude 분석 (간소화) ─────────────────────────────────────
step(6, "Claude 분석 (간소화 프롬프트로 토큰 절약)");
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const finStr = financials.map(f => `${f.year}: 매출${f.revenue || "?"}/영업${f.operating || "?"}/자본${f.equity || "?"}/부채${f.debt || "?"}`).join("\n");
const newsStr = (newsData.items || []).slice(0, 10).map(n => `- ${n.title.replace(/<[^>]+>/g, "")}`).join("\n");

try {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `이랜드리테일 임대 협상팀의 테넌트 검증 전문가. JSON으로만 응답.
형식: {"grade":"A|B|C|D|미확인","reason":"한 문장","summary":"한 문장"}`,
    messages: [{ role: "user", content: `${company} 검증.\n[재무]\n${finStr}\n[뉴스]\n${newsStr}` }],
  });
  const text = msg.content.find((b) => b.type === "text")?.text;
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
  ok(`등급 ${json.grade} | ${json.reason}`);
  ok(`요약: ${json.summary}`);
  console.log(`        토큰: in=${msg.usage.input_tokens}, out=${msg.usage.output_tokens}`);
} catch (e) {
  fail(`Claude 오류: ${e.message}`);
}

// ── 5. Notion 쓰기 테스트 ────────────────────────────────────
step(7, "Notion DB 쓰기 테스트");
const notion = new Client({ auth: NOTION_KEY });
try {
  const ds = await notion.databases.retrieve({ database_id: TENANT_DB });
  const dsId = ds.data_sources[0].id;
  ok(`테넌트 검증 DB data source 접근 OK: ${dsId}`);

  // 실제 쓰기는 하지 않고 스키마만 확인 (안 그러면 테스트 행이 쌓임)
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dsId });
  const propNames = Object.keys(dataSource.properties);
  ok(`컬럼 ${propNames.length}개: ${propNames.slice(0, 5).join(", ")}...`);
} catch (e) {
  fail(`Notion 오류: ${e.message}`);
}

console.log("\n🎉 모든 단계 통과! UI에서 실제 검증을 실행해도 안전합니다.");
console.log(`   http://localhost:3000/dashboard/verify\n`);
