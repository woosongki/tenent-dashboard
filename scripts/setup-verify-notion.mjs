#!/usr/bin/env node
/**
 * Notion v5 API로 컨텐츠 검증 도구용 DB 2개를 생성하거나 업데이트합니다.
 *
 * 동작 방식:
 * - .env.local에 NOTION_DB_VERIFY_TENANT_ID 가 이미 있으면 → 해당 DB의 data source에 properties 업데이트
 * - 없으면 → 부모 페이지 아래에 새 DB 생성 (initial_data_source.properties)
 *
 * 실행: node scripts/setup-verify-notion.mjs
 */

import { config } from "dotenv";
import { Client } from "@notionhq/client";
import { readFileSync, writeFileSync, existsSync } from "fs";

config({ path: ".env.local", override: true });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// MCP/Notion 앱으로 사전 생성한 부모 페이지 (Internal Integration이 접근 가능해야 함)
const PARENT_PAGE_ID =
  process.env.NOTION_VERIFY_PARENT_PAGE_ID ?? "3671a825-5b15-81ed-a308-de5d781c2c0a";

// ── 스키마 정의 ─────────────────────────────────────────────────
const TENANT_PROPERTIES = {
  "회사명":           { title: {} },
  "약칭/브랜드":      { rich_text: {} },
  "사업자번호":       { rich_text: {} },
  "DART 고유번호":    { rich_text: {} },
  "법인구분": {
    select: {
      options: [
        { name: "상장(유가증권)", color: "blue" },
        { name: "상장(코스닥)",   color: "green" },
        { name: "상장(코넥스)",   color: "purple" },
        { name: "외감 비상장",    color: "yellow" },
        { name: "기타",           color: "gray" },
        { name: "미확인",         color: "default" },
      ],
    },
  },
  "업종": {
    select: {
      options: [
        { name: "패션/의류",       color: "pink" },
        { name: "F&B",             color: "orange" },
        { name: "생활용품",        color: "green" },
        { name: "뷰티/헬스",       color: "purple" },
        { name: "스포츠/아웃도어", color: "blue" },
        { name: "아동/유아",       color: "yellow" },
        { name: "전자/IT",         color: "gray" },
        { name: "기타",            color: "default" },
      ],
    },
  },
  "재무 등급": {
    select: {
      options: [
        { name: "A", color: "blue" },
        { name: "B", color: "yellow" },
        { name: "C", color: "orange" },
        { name: "D", color: "red" },
        { name: "미확인", color: "gray" },
      ],
    },
  },
  "최근 매출":  { number: { format: "number_with_commas" } },
  "영업이익률": { number: { format: "percent" } },
  "핵심 리스크": {
    multi_select: {
      options: [
        { name: "자본잠식",         color: "red" },
        { name: "감사의견 비적정",  color: "red" },
        { name: "계속기업 불확실",  color: "red" },
        { name: "횡령/배임",        color: "orange" },
        { name: "관리종목",         color: "orange" },
        { name: "잦은 증자",        color: "yellow" },
        { name: "과다 부채",        color: "yellow" },
        { name: "소송",             color: "gray" },
      ],
    },
  },
  "집중 영역 (Top 3)": { rich_text: {} },
  "검증일":      { date: {} },
  "미팅 예정일": { date: {} },
  "출처 신뢰도": {
    select: {
      options: [
        { name: "검증됨",    color: "blue" },
        { name: "보도 확인", color: "yellow" },
        { name: "일부 추정", color: "orange" },
      ],
    },
  },
  "다음 재검토일": { date: {} },
  "비고":          { rich_text: {} },
};

const NEWS_PROPERTIES = {
  "제목":   { title: {} },
  "회사":   { rich_text: {} },
  "보도일": { date: {} },
  "매체":   { rich_text: {} },
  "URL":    { url: {} },
  "카테고리": {
    select: {
      options: [
        { name: "출점·매장 전략", color: "blue" },
        { name: "카테고리 확장",  color: "green" },
        { name: "인프라·물류",    color: "orange" },
        { name: "법적·규제 이슈", color: "red" },
        { name: "인사·조직 변동", color: "purple" },
        { name: "재무 이벤트",    color: "yellow" },
        { name: "온·오프 연계",   color: "pink" },
        { name: "기타",           color: "gray" },
      ],
    },
  },
  "요약": { rich_text: {} },
  "신뢰도": {
    select: {
      options: [
        { name: "검증됨",    color: "blue" },
        { name: "보도 확인", color: "yellow" },
        { name: "참고",      color: "gray" },
      ],
    },
  },
};

// ── 유틸 ────────────────────────────────────────────────────────
async function getDataSourceId(databaseId) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  return db.data_sources?.[0]?.id;
}

async function createOrUpdateDb(name, icon, properties, existingDbId) {
  if (existingDbId) {
    const dsId = await getDataSourceId(existingDbId);
    if (!dsId) throw new Error(`${name}: data source를 찾을 수 없음`);

    // 기존 title property("Name")의 이름을 새 title 이름으로 rename
    // (Notion은 DB당 1개의 title만 허용 → 새로 추가 불가, rename만 가능)
    const titleEntry = Object.entries(properties).find(([, v]) => "title" in v);
    const newTitleName = titleEntry?.[0];
    // properties에서 title은 제외 (rename으로 처리)
    const nonTitleProps = Object.fromEntries(
      Object.entries(properties).filter(([, v]) => !("title" in v))
    );

    const updatePayload = { ...nonTitleProps };
    if (newTitleName && newTitleName !== "Name") {
      updatePayload["Name"] = { name: newTitleName };
    }

    await notion.dataSources.update({
      data_source_id: dsId,
      properties: updatePayload,
    });
    console.log(`   업데이트 완료: ${existingDbId} (data source: ${dsId})`);
    return existingDbId;
  }
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: name } }],
    icon: { type: "emoji", emoji: icon },
    initial_data_source: { properties },
  });
  console.log(`   생성 완료: ${db.id}`);
  return db.id;
}

async function appendEnvLocal(tenantDbId, newsDbId) {
  const envPath = ".env.local";
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

  // 기존 NOTION_DB_VERIFY_* 항목 제거 후 새로 추가
  const filtered = existing
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("NOTION_DB_VERIFY_") && !l.startsWith("# 컨텐츠 검증 도구"))
    .join("\n")
    .replace(/\n+$/, "");

  const toAdd = `\n\n# 컨텐츠 검증 도구 (setup-verify-notion.mjs 자동 생성)\nNOTION_DB_VERIFY_TENANT_ID=${tenantDbId}\nNOTION_DB_VERIFY_NEWS_ID=${newsDbId}\n`;

  writeFileSync(envPath, filtered + toAdd);
  console.log("   ✅ .env.local 업데이트 완료");
}

async function checkParentAccess() {
  try {
    await notion.pages.retrieve({ page_id: PARENT_PAGE_ID });
  } catch {
    console.error(`\n❌ 부모 페이지 접근 실패: ${PARENT_PAGE_ID}`);
    console.error(`   Notion에서 "컨텐츠 검증 도구" 페이지를 열고`);
    console.error(`   우측 상단 ··· → 연결 → 본인 Integration 추가가 필요합니다.\n`);
    process.exit(1);
  }
}

// ── 메인 ────────────────────────────────────────────────────────
async function main() {
  if (!process.env.NOTION_API_KEY) {
    console.error("❌ NOTION_API_KEY가 .env.local에 없습니다");
    process.exit(1);
  }

  console.log("1️⃣  부모 페이지 접근 권한 확인 중...");
  await checkParentAccess();
  console.log(`   Page ID: ${PARENT_PAGE_ID}`);

  const existingTenantId = process.env.NOTION_DB_VERIFY_TENANT_ID;
  const existingNewsId = process.env.NOTION_DB_VERIFY_NEWS_ID;

  console.log("2️⃣  '컨텐츠 검증' DB 처리 중...");
  const tenantDbId = await createOrUpdateDb("컨텐츠 검증", "✅", TENANT_PROPERTIES, existingTenantId);

  console.log("3️⃣  '수집 뉴스' DB 처리 중...");
  const newsDbId = await createOrUpdateDb("수집 뉴스", "📰", NEWS_PROPERTIES, existingNewsId);

  console.log("4️⃣  .env.local 업데이트 중...");
  await appendEnvLocal(tenantDbId, newsDbId);

  console.log("\n✅ 완료! 서버를 재시작하세요.");
  console.log(`📌 Notion 링크: https://notion.so/${PARENT_PAGE_ID.replace(/-/g, "")}`);
}

main().catch((err) => {
  console.error("❌ 오류:", err.message ?? err);
  process.exit(1);
});
