import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  getNotionClient, NOTION_DATA_SOURCE_IDS,
  getTitle, getRichText, getSelect, getMultiSelect,
  getNumber, getCheckbox, getStatus, getUrl, getPhone,
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

/**
 * 대상 테이블의 (notion_url → id) 맵을 1회 페치.
 * 동일 notion_url에 여러 id가 있으면 created_at이 가장 빠른 1건을 정본으로 둔다
 * (이후 update가 정본을 향하도록). DB UNIQUE 제약이 빠진 환경에서도
 * 중복 없이 멱등 동기화하기 위한 핵심 헬퍼.
 */
type AdminClient = ReturnType<typeof getSupabaseAdmin>;

async function loadNotionUrlMap(
  admin: AdminClient,
  table: "attraction_status" | "vendor_fnb" | "vendor_lease",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await admin
    .from(table)
    .select("id, notion_url, created_at")
    .not("notion_url", "is", null)
    .order("created_at", { ascending: true });
  if (error || !data) return map;
  for (const row of data as Array<{ id: string; notion_url: string | null }>) {
    if (row.notion_url && !map.has(row.notion_url)) map.set(row.notion_url, row.id);
  }
  return map;
}

// ── 1. 입점계획 (attraction_status) ──────────────────────────
export async function syncAttraction(): Promise<SyncResult> {
  const result: SyncResult = { table: "attraction_status", fetched: 0, upserted: 0, errors: [] };
  try {
    const pages = await fetchAllPages(NOTION_DATA_SOURCE_IDS.attraction);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();

    // 기존 행을 미리 로드해 notion_url → id 맵을 만든다.
    // DB에 UNIQUE 제약이 빠져 있어도 이 맵으로 update vs insert를 분기해
    // 멱등하게 동기화한다 (중복 방지).
    const urlToId = await loadNotionUrlMap(admin, "attraction_status");

    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const url   = (page as { url: string }).url;

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

      const existingId = url ? urlToId.get(url) : undefined;
      const { error } = existingId
        ? await admin.from("attraction_status").update(record).eq("id", existingId)
        : await admin.from("attraction_status").insert(record);

      if (error) result.errors.push(`[${brandName}] ${error.message}`);
      else result.upserted++;
    }
  } catch (e) {
    result.errors.push(String(e));
  }
  return result;
}

// ── 2. 업체리스트 F&B (vendor_fnb) ─────────────────────────
// (기존 상가 시세 marketPrice 동기화는 제거됨 — 41개 점포 마스터 + k-skill-proxy 실거래가로 전환)

export async function syncVendorFnb(): Promise<SyncResult> {
  const result: SyncResult = { table: "vendor_fnb", fetched: 0, upserted: 0, errors: [] };
  try {
    const pages = await fetchAllPages(NOTION_DATA_SOURCE_IDS.vendorFnb);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();
    const urlToId = await loadNotionUrlMap(admin, "vendor_fnb");

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

      const existingId = notionUrl ? urlToId.get(notionUrl) : undefined;
      const { error } = existingId
        ? await admin.from("vendor_fnb").update(record).eq("id", existingId)
        : await admin.from("vendor_fnb").insert(record);

      if (error) result.errors.push(`[${name}] ${error.message}`);
      else result.upserted++;
    }
  } catch (e) {
    result.errors.push(String(e));
  }
  return result;
}

// ── 3. 업체리스트 일반임대 (vendor_lease) ──────────────────
export async function syncVendorLease(): Promise<SyncResult> {
  const result: SyncResult = { table: "vendor_lease", fetched: 0, upserted: 0, errors: [] };

  const dataSourceId = NOTION_DATA_SOURCE_IDS.vendorLease;
  if (!dataSourceId) {
    result.errors.push("NOTION_DS_VENDOR_LEASE 환경변수가 설정되지 않았습니다.");
    return result;
  }

  try {
    const pages = await fetchAllPages(dataSourceId);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();
    const urlToId = await loadNotionUrlMap(admin, "vendor_lease");

    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const notionUrl = (page as { url: string }).url;

      // title 컬럼명이 "업체명" 또는 "이름" 둘 다 허용
      const name = getTitle(props, "업체명") || getTitle(props, "이름");
      if (!name) continue;

      const record = {
        name,
        types:      getMultiSelect(props, "유형"),
        score:      getSelect(props,      "정성점수"),
        is_checked: getCheckbox(props,    "체크박스"),
        status:     getStatus(props,      "영업진행"),
        link:       getUrl(props,         "링크"),
        contact:    getPhone(props,       "연락처"),
        keyman:     getRichText(props,    "키맨"),
        memo:       getRichText(props,    "기타"),
        notion_url: notionUrl,
      };

      const existingId = notionUrl ? urlToId.get(notionUrl) : undefined;
      const { error } = existingId
        ? await admin.from("vendor_lease").update(record).eq("id", existingId)
        : await admin.from("vendor_lease").insert(record);

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
  const [a, v, l] = await Promise.all([
    syncAttraction(),
    syncVendorFnb(),
    syncVendorLease(),
  ]);
  return [a, v, l];
}
