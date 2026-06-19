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
 * 전략: notion_url을 기준으로 upsert (존재하면 업데이트, 없으면 insert).
 *   - DB: notion_url partial UNIQUE INDEX (supabase/*.sql) — 중복 INSERT를 DB가 거부.
 *   - 코드: insert 대신 upsert(onConflict: notion_url) — 경합/재실행에도 1행 보장.
 *   - 추가 방어: 매 sync 시작 시 과거 누적 중복을 dedupe로 자가치유.
 * 노션에서 삭제된 행은 별도 로직 없이 잔존 (운영 안전성 우선).
 *
 * ⚠ notion_url이 비어있는(null) 노션 페이지는 upsert 키가 없으므로 건너뛴다
 *    (키 없는 INSERT는 매번 중복을 만들기 때문 — 신뢰성 우선).
 */

interface SyncResult {
  table: string;
  fetched: number;
  upserted: number;
  /** 이번 sync에서 자가치유로 삭제한 중복 행 수 */
  deduped: number;
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

type AdminClient = ReturnType<typeof getSupabaseAdmin>;
type SyncTable = "attraction_status" | "vendor_fnb" | "vendor_lease";

interface ExistingRow {
  id: string;
  notion_url: string | null;
  created_at: string;
}

/**
 * 대상 테이블의 모든 행을 chunk 페이지네이션으로 로드.
 * PostgREST 기본 cap이 1000이라 한 번의 select 만으로는 1000을 초과한 행을
 * 보지 못한다. 중복이 누적된 환경에서는 이 cap에 걸려 일부 기존 행이
 * map에 빠지고, 같은 notion_url이 또 INSERT되어 중복이 더 쌓이는
 * 악순환이 발생한다 — 반드시 페이지네이션 필요.
 */
async function loadAllRows(
  admin: AdminClient,
  table: SyncTable,
): Promise<ExistingRow[]> {
  const all: ExistingRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select("id, notion_url, created_at")
      .order("created_at", { ascending: true })
      .order("id",         { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as ExistingRow[]));
    if (data.length < PAGE) break;
  }
  return all;
}

/**
 * notion_url 별로 created_at 가장 빠른 1건만 남기고 나머지를 삭제.
 * 이전 버전 sync에서 누적된 중복이 있어도 이 단계가 자가치유한다.
 * DB에 UNIQUE 제약이 없어도, 매 sync마다 0건의 중복으로 정리됨.
 */
async function dedupeByNotionUrl(
  admin: AdminClient,
  table: SyncTable,
  rows: ExistingRow[],
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  // notion_url 별 그룹화 (null 제외)
  const groups = new Map<string, ExistingRow[]>();
  for (const r of rows) {
    if (!r.notion_url) continue;
    const arr = groups.get(r.notion_url) ?? [];
    arr.push(r);
    groups.set(r.notion_url, arr);
  }
  const idsToDelete: string[] = [];
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    // created_at asc + id asc 로 정렬되어 있다고 가정 (loadAllRows의 order)
    // 가장 오래된 1건 유지, 나머지 삭제 대상.
    for (let i = 1; i < arr.length; i++) idsToDelete.push(arr[i].id);
  }
  if (idsToDelete.length === 0) return { deleted: 0, errors };
  // chunk 단위로 삭제 (URL 길이/파라미터 한도 회피)
  const CHUNK = 200;
  for (let i = 0; i < idsToDelete.length; i += CHUNK) {
    const slice = idsToDelete.slice(i, i + CHUNK);
    const { error } = await admin.from(table).delete().in("id", slice);
    if (error) errors.push(`dedupe ${table}: ${error.message}`);
  }
  return { deleted: idsToDelete.length, errors };
}

// ── 1. 입점계획 (attraction_status) ──────────────────────────
export async function syncAttraction(): Promise<SyncResult> {
  const result: SyncResult = { table: "attraction_status", fetched: 0, upserted: 0, deduped: 0, errors: [] };
  try {
    const pages = await fetchAllPages(NOTION_DATA_SOURCE_IDS.attraction);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();

    // 1) 기존 모든 행을 페이지네이션으로 로드 (PostgREST 1000 cap 회피).
    // 2) notion_url 중복 자가치유 (가장 오래된 1건만 유지).
    // 3) 정리된 결과로 url → id 맵 작성. 이후 update / insert 분기.
    const existing = await loadAllRows(admin, "attraction_status");
    const dedupe = await dedupeByNotionUrl(admin, "attraction_status", existing);
    result.deduped = dedupe.deleted;
    result.errors.push(...dedupe.errors);

    // 노션 측 중복 방어: 같은 (브랜드+지점+층+카테고리) 조합이 여러 노션 페이지에
    // 입력된 경우, 첫 페이지만 upsert하고 나머지는 건너뜀. 이전엔 둘 다 INSERT되어
    // brand-level 중복이 누적됐다. 노션을 정리하기 전까지의 방어선.
    const seenBrandKeys = new Set<string>();
    const norm = (v: string | null) => (v ?? "").trim().toLowerCase();

    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const url   = (page as { url: string }).url;

      const brandName = getTitle(props, "컨텐츠 브랜드");
      if (!brandName) continue;
      // notion_url이 없으면 upsert 키가 없어 중복 위험 → 건너뜀
      if (!url) { result.errors.push(`[${brandName}] notion_url 없음 — 건너뜀`); continue; }

      const branch   = getSelect(props, "지점");
      const floor    = getSelect(props, "층");
      const category = getSelect(props, "카테고리");

      // 느슨한 키: brand_name + branch만 보아 진행중↔완료, 층/카테고리 변경도
      // 같은 컨텐츠로 본다 (캐노니컬한 1행만 sync에 통과).
      const brandKey = `${norm(brandName)}|${norm(branch)}`;
      if (seenBrandKeys.has(brandKey)) {
        result.errors.push(`[${brandName}] ${branch ?? "-"} 노션 중복 페이지 건너뜀 (브랜드+지점 동일)`);
        continue;
      }
      seenBrandKeys.add(brandKey);

      const record = {
        brand_name:   brandName,
        branch,
        floor,
        category,
        size_pyeong:  getNumber(props, "규모(평)"),
        manager:      getRichText(props, "담당자"),
        is_completed: getCheckbox(props, "완료여부"),
        memo:         getRichText(props, "기타"),
        notion_url:   url,
      };

      const { error } = await admin
        .from("attraction_status")
        .upsert(record, { onConflict: "notion_url" });

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
  const result: SyncResult = { table: "vendor_fnb", fetched: 0, upserted: 0, deduped: 0, errors: [] };
  try {
    const pages = await fetchAllPages(NOTION_DATA_SOURCE_IDS.vendorFnb);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();
    const existing = await loadAllRows(admin, "vendor_fnb");
    const dedupe = await dedupeByNotionUrl(admin, "vendor_fnb", existing);
    result.deduped = dedupe.deleted;
    result.errors.push(...dedupe.errors);

    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const notionUrl = (page as { url: string }).url;

      const name = getTitle(props, "업체명");
      if (!name) continue;
      if (!notionUrl) { result.errors.push(`[${name}] notion_url 없음 — 건너뜀`); continue; }

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

// ── 3. 업체리스트 일반임대 (vendor_lease) ──────────────────
export async function syncVendorLease(): Promise<SyncResult> {
  const result: SyncResult = { table: "vendor_lease", fetched: 0, upserted: 0, deduped: 0, errors: [] };

  const dataSourceId = NOTION_DATA_SOURCE_IDS.vendorLease;
  if (!dataSourceId) {
    result.errors.push("NOTION_DS_VENDOR_LEASE 환경변수가 설정되지 않았습니다.");
    return result;
  }

  try {
    const pages = await fetchAllPages(dataSourceId);
    result.fetched = pages.length;

    const admin = getSupabaseAdmin();
    const existing = await loadAllRows(admin, "vendor_lease");
    const dedupe = await dedupeByNotionUrl(admin, "vendor_lease", existing);
    result.deduped = dedupe.deleted;
    result.errors.push(...dedupe.errors);

    for (const page of pages) {
      const props = (page as { properties: Record<string, unknown> }).properties;
      const notionUrl = (page as { url: string }).url;

      // title 컬럼명이 "업체명" 또는 "이름" 둘 다 허용
      const name = getTitle(props, "업체명") || getTitle(props, "이름");
      if (!name) continue;
      if (!notionUrl) { result.errors.push(`[${name}] notion_url 없음 — 건너뜀`); continue; }

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

      const { error } = await admin
        .from("vendor_lease")
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
  const [a, v, l] = await Promise.all([
    syncAttraction(),
    syncVendorFnb(),
    syncVendorLease(),
  ]);
  return [a, v, l];
}
