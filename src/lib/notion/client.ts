import { Client } from "@notionhq/client";

/**
 * 환경 변수:
 *   NOTION_API_KEY                — Notion Internal Integration Token (secret_…)
 *   NOTION_DB_ATTRACTION          — 이랜드리테일 컨텐츠 유치 현황 DB ID
 *   NOTION_DB_MARKET_PRICE        — 상가 시세 데이터 DB ID
 *   NOTION_DB_VENDOR_FNB          — 업체리스트(F&B) DB ID
 *   NOTION_DB_VENDOR_LEASE        — 업체리스트(일반임대) DB ID
 *   NOTION_DS_VENDOR_LEASE        — 업체리스트(일반임대) Data Source ID
 *   CRON_SECRET                   — /api/sync/notion 보호용 토큰
 */

export function getNotionClient(): Client | null {
  const token = process.env.NOTION_API_KEY;
  if (!token) return null;
  return new Client({ auth: token });
}

/**
 * Notion v5 API는 데이터베이스 안의 데이터 소스(collection) ID로 쿼리.
 * 우리가 fetch로 확인한 collection ID:
 * - 입점계획: 186e75da-dde4-45da-b821-aa1adcb4577b
 * - 시세:    894f52d4-0679-4e1f-b92d-61e115b1c263
 * - F&B:     86467945-ee32-414d-9d1e-3be8b01b021d
 */
export const NOTION_DB_IDS = {
  attraction:  process.env.NOTION_DB_ATTRACTION   ?? "cc900291-4524-4a66-94d7-2a3373ade75d",
  vendorFnb:   process.env.NOTION_DB_VENDOR_FNB   ?? "b204fdd0-3637-4ca0-8897-eca031ccf1e0",
  vendorLease: process.env.NOTION_DB_VENDOR_LEASE ?? "",
} as const;

export const NOTION_DATA_SOURCE_IDS = {
  attraction:  process.env.NOTION_DS_ATTRACTION   ?? "186e75da-dde4-45da-b821-aa1adcb4577b",
  vendorFnb:   process.env.NOTION_DS_VENDOR_FNB   ?? "86467945-ee32-414d-9d1e-3be8b01b021d",
  // ★ Vercel 환경변수에 NOTION_DS_VENDOR_LEASE 를 설정하세요
  // Notion 페이지 "업체리스트(일반임대)"의 Data Source ID (collection ID)
  vendorLease: process.env.NOTION_DS_VENDOR_LEASE ?? "",
} as const;

// ── Property 추출 헬퍼 ──────────────────────────────────────
type AnyProp = Record<string, unknown>;

export function getTitle(props: AnyProp, name: string): string {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "title") return "";
  const arr = (p.title as Array<{ plain_text: string }>) ?? [];
  return arr.map((x) => x.plain_text).join("").trim();
}

export function getRichText(props: AnyProp, name: string): string | null {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "rich_text") return null;
  const arr = (p.rich_text as Array<{ plain_text: string }>) ?? [];
  const v = arr.map((x) => x.plain_text).join("").trim();
  return v || null;
}

export function getSelect(props: AnyProp, name: string): string | null {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "select") return null;
  const v = p.select as { name: string } | null;
  return v?.name ?? null;
}

export function getMultiSelect(props: AnyProp, name: string): string[] {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "multi_select") return [];
  const arr = (p.multi_select as Array<{ name: string }>) ?? [];
  return arr.map((x) => x.name);
}

export function getNumber(props: AnyProp, name: string): number | null {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "number") return null;
  return (p.number as number | null) ?? null;
}

export function getCheckbox(props: AnyProp, name: string): boolean {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "checkbox") return false;
  return Boolean(p.checkbox);
}

export function getStatus(props: AnyProp, name: string): string | null {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "status") return null;
  const v = p.status as { name: string } | null;
  return v?.name ?? null;
}

export function getUrl(props: AnyProp, name: string): string | null {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "url") return null;
  return (p.url as string | null) ?? null;
}

export function getPhone(props: AnyProp, name: string): string | null {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "phone_number") return null;
  return (p.phone_number as string | null) ?? null;
}

export function getDate(props: AnyProp, name: string): string | null {
  const p = props[name] as AnyProp | undefined;
  if (!p || p.type !== "date") return null;
  const v = p.date as { start: string } | null;
  return v?.start ?? null;
}
