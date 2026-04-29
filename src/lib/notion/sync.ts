import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  getNotionClient, NOTION_DATA_SOURCE_IDS,
  getTitle, getRichText, getSelect, getMultiSelect,
  getNumber, getCheckbox, getStatus, getUrl, getPhone, getDate,
} from "./client";

/**
 * 노션 → Supabase 풀 싱크.
 * Cron(매일 새벽) 또는 수동 트리거(/api/sync/notion)로 실행.
 *
 * 전략: notion_id를 기준으로 upsert (존재하면 업데이트, 없으면 insert).
 * 노션에서 삭제된 행은 별도 로직 없이 잔존 (운영 안전성 우선).
 */

interface SyncResult {
  table: string;
  fetched: number;
  upserted: number;
  errors: string[];
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin credentials missing");
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } });
}

// ── 헬퍼 ────────────────────────────────────────────────────
async function fetchAllPages(dataSourceId: string): Promise<Record<string, unknown>[]> {
  const notion = getNotionClient();
  if (!notion) throw new Error("NOTION_API_KEY not configured");

  const all: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const resp = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...(resp.results as unknown as Record<string, unknown>[]));
    cursor = (resp as { next_cursor?: string | null }).next_cursor ?? undefined;
  } while (cursor);
  return all;
}

// ── 1. 입점계획 (attraction_status) ──────────────────────────
export async function syncAttraction(): Promise<SyncResult> {
  const result: SyncResult = { table: "attraction_status", fetched: 0, upserted: 0, errors: [] };
  try {
    const pages = await fetchAllPages(NOTION_DATA_SOURCE_IDS.attraction);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();
    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const notionId = (page as { id: string }).id;
      const url      = (page as { url: string }).url;

      const brandName = getTitle(props, "컨텐츠 브랜드");
      if (!brandName) continue;

      const record = {
        brand_name:   brandName,
        branch:       getSelect(props, "지점"),
        floor:        getSelect(props, "층"),
        category:     getSelect(props, "카테고리"),
        size_pyeong:  getNumber(props, "규모(평)"),
        manager:      getRichText(props, "담당자"),
        is_completed: getCheckbox(props, "완료여부"),
        memo:         getRichText(props, "기타"),
        notion_url:   url,
      };

      // notion_url unique로 upsert
      const { error } = await admin
        .from("attraction_status")
        .upsert(record, { onConflict: "notion_url" });
      if (error) result.errors.push(`[${brandName}] ${error.message}`);
      else result.upserted++;
      // notionId 변수는 향후 별도 컬럼 추가 시 사용 — 사용 표시
      void notionId;
    }
  } catch (e) {
    result.errors.push(String(e));
  }
  return result;
}

// ── 2. 상가 시세 (market_price_data) ───────────────────────
export async function syncMarketPrice(): Promise<SyncResult> {
  const result: SyncResult = { table: "market_price_data", fetched: 0, upserted: 0, errors: [] };
  try {
    const pages = await fetchAllPages(NOTION_DATA_SOURCE_IDS.marketPrice);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();
    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const notionUrl = (page as { url: string }).url;

      const name = getTitle(props, "지점");
      if (!name) continue;

      const record = {
        name,
        brand:               getSelect(props,   "브랜드"),
        contract_type:       getSelect(props,   "계약유형"),
        size_range:          getSelect(props,   "평수구간"),
        deposit_median:      getRichText(props, "보증금_중앙값"),
        monthly_rent_median: getRichText(props, "월세_중앙값"),
        floor_type:          getSelect(props,   "층수"),
        rent_per_pyeong:     getRichText(props, "평당월세_역산"),
        store_type:          getSelect(props,   "상가유형"),
        region:              getSelect(props,   "지역구분"),
        reliability:         getSelect(props,   "신뢰도"),
        price_trend:         getSelect(props,   "지수추세"),
        data_source:         getSelect(props,   "데이터출처"),
        sample_count:        getRichText(props, "표본건수"),
        note:                getRichText(props, "비고"),
        last_updated:        getDate(props,     "최종갱신일"),
        notion_url:          notionUrl,
      };

      const { error } = await admin
        .from("market_price_data")
        .upsert(record, { onConflict: "notion_url" });
      if (error) result.errors.push(`[${name}] ${error.message}`);
      else result.upserted++;
    }
  } catch (e) {
    result.errors.push(String(e));
  }
  return result;
}

// ── 3. 업체리스트 F&B (vendor_fnb) ─────────────────────────
export async function syncVendorFnb(): Promise<SyncResult> {
  const result: SyncResult = { table: "vendor_fnb", fetched: 0, upserted: 0, errors: [] };
  try {
    const pages = await fetchAllPages(NOTION_DATA_SOURCE_IDS.vendorFnb);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();
    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const notionUrl = (page as { url: string }).url;

      const name = getTitle(props, "업체명");
      if (!name) continue;

      const record = {
        name,
        types:      getMultiSelect(props, "유형"),
        score:      getSelect(props,      "점수"),
        is_checked: getCheckbox(props,    "체크박스"),
        status:     getStatus(props,      "팝업중"),
        link:       getUrl(props,         "링크"),
        contact:    getPhone(props,       "연락처"),
        keyman:     getRichText(props,    "키맨"),
        memo:       getRichText(props,    "기타"),
        notion_url: notionUrl,
      };

      const { error } = await admin
        .from("vendor_fnb")
        .upsert(record, { onConflict: "notion_url" });
      if (error) result.errors.push(`[${name}] ${error.message}`);
      else result.upserted++;
    }
  } catch (e) {
    result.errors.push(String(e));
  }
  return result;
}

// ── 통합 실행 ───────────────────────────────────────────────
export async function syncAll(): Promise<SyncResult[]> {
  const [a, m, v] = await Promise.all([
    syncAttraction(),
    syncMarketPrice(),
    syncVendorFnb(),
  ]);
  return [a, m, v];
}
