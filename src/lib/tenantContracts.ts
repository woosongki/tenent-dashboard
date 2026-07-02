import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────
// 입점업체 계약 마스터 로더 (Supabase 기반)
//
// ERP 스냅샷 → 로컬 TSV → `npm run upload:contracts` → Supabase tenant_contracts.
// 로컬 dev 서버와 Vercel 프로덕션 모두 이 테이블을 통해 조회.
// 앱에서는 조회 전용 (RLS 로 write 차단, 업로드 스크립트만 갱신).
//
// 요청 스코프 메모이제이션: 한 페이지 렌더에서 여러 함수가 호출돼도
// React cache() 로 Supabase 왕복 1회로 억제.
// ─────────────────────────────────────────────────────────────

export type ContractType =
  | "임대갑"
  | "임대을"
  | "임대갑(단기)"
  | "임대을(단기)"
  | "판매분특정"
  | "판매분특정(단기)";

export interface TenantContract {
  plantCode: string;
  storeName: string;
  contractType: ContractType | string;
  floor: string | null;
  purchaseGroup: string | null;
  purchaseCode: string | null;
  purchaseName: string | null;
  brand: string;
  representative: string | null;
  firstContractDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  renewalStatus: string | null;
  businessId: string | null;
  contractNumber: string | null;
  md: string | null;
  storeManager: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
}

interface Loaded {
  source: string;
  importedAt: string;
  contracts: TenantContract[];
}

interface DbRow {
  plant_code: string;
  store_name: string;
  contract_type: string;
  floor: string | null;
  purchase_group: string | null;
  purchase_code: string | null;
  purchase_name: string | null;
  brand: string;
  representative: string | null;
  first_contract_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  renewal_status: string | null;
  business_id: string | null;
  contract_number: string | null;
  md: string | null;
  store_manager: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  imported_at: string;
}

function mapRow(r: DbRow): TenantContract {
  return {
    plantCode:         r.plant_code,
    storeName:         r.store_name,
    contractType:      r.contract_type,
    floor:             r.floor,
    purchaseGroup:     r.purchase_group,
    purchaseCode:      r.purchase_code,
    purchaseName:      r.purchase_name,
    brand:             r.brand,
    representative:    r.representative,
    firstContractDate: r.first_contract_date,
    contractStartDate: r.contract_start_date,
    contractEndDate:   r.contract_end_date,
    renewalStatus:     r.renewal_status,
    businessId:        r.business_id,
    contractNumber:    r.contract_number,
    md:                r.md,
    storeManager:      r.store_manager,
    contactPerson:     r.contact_person,
    phone:             r.phone,
    email:             r.email,
  };
}

// PostgREST 기본 cap 1000 을 넘는 경우가 있으니 페이지네이션.
const load = cache(async (): Promise<Loaded> => {
  const supabase = await createClient();
  const contracts: TenantContract[] = [];
  const PAGE = 1000;
  let source = "";
  let importedAt = "";

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("tenant_contracts")
      .select("*")
      .order("contract_end_date", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[tenantContracts] load failed:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const r of data as DbRow[]) {
      contracts.push(mapRow(r));
      // 스냅샷 전체가 같은 imported_at/source (DELETE→INSERT 방식) —
      // 그래도 안전하게 max 로 갱신.
      if (r.source && (!source || r.imported_at > importedAt)) {
        source = r.source;
        importedAt = r.imported_at;
      }
    }
    if (data.length < PAGE) break;
  }

  return { source, importedAt: importedAt || new Date(0).toISOString(), contracts };
});

// ── public API ────────────────────────────────────────────────

export async function getTenantContracts(): Promise<TenantContract[]> {
  return (await load()).contracts;
}

export async function getTenantContractsMeta(): Promise<{
  source: string;
  importedAt: string;
  count: number;
}> {
  const l = await load();
  return { source: l.source, importedAt: l.importedAt, count: l.contracts.length };
}

function normalizeBrand(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]【】,·・‧,、。.\-_/&+]/g, "");
}

/** 브랜드명·구매처명·상호 유사매칭. 미팅 카드 프리필용. */
export async function findContractsByBrand(
  brand: string,
  opts?: { includeExpired?: boolean }
): Promise<TenantContract[]> {
  const q = normalizeBrand(brand);
  if (!q) return [];
  const all = await getTenantContracts();
  const today = new Date().toISOString().slice(0, 10);
  const hits = all.filter((c) => {
    const b = normalizeBrand(c.brand);
    const p = c.purchaseName ? normalizeBrand(c.purchaseName) : "";
    return b === q || p === q || b.includes(q) || q.includes(b) || p.includes(q);
  });
  const filtered = opts?.includeExpired
    ? hits
    : hits.filter((c) => !c.contractEndDate || c.contractEndDate >= today);
  return filtered.sort((a, b) => (b.contractEndDate ?? "").localeCompare(a.contractEndDate ?? ""));
}

export async function findContractsByBusinessId(bizId: string): Promise<TenantContract[]> {
  const q = bizId.replace(/\D/g, "");
  if (q.length !== 10) return [];
  return (await getTenantContracts()).filter((c) => c.businessId === q);
}

export interface ExpiringOpts {
  /** 오늘 기준 이 일수 이내 만료 (기본 60일) */
  withinDays?: number;
  /** 이미 종료·퇴점·자동연장 상태 제외 (기본 true) */
  excludeSettled?: boolean;
  /** 지점명 필터 */
  storeName?: string;
  /** 계약형태 필터 */
  contractType?: string;
}

const SETTLED_MARKERS = ["종료", "퇴점", "중도퇴점", "자동연장", "재계약"];

/** 만료 임박 계약 리스트. 만료일 오름차순 정렬. */
export async function getExpiringContracts(
  opts: ExpiringOpts = {}
): Promise<(TenantContract & { daysUntilExpiry: number })[]> {
  const withinDays = opts.withinDays ?? 60;
  const excludeSettled = opts.excludeSettled ?? true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + withinDays);

  const rows: (TenantContract & { daysUntilExpiry: number })[] = [];
  for (const c of await getTenantContracts()) {
    if (!c.contractEndDate) continue;
    const end = new Date(c.contractEndDate + "T00:00:00");
    if (!Number.isFinite(end.getTime())) continue;
    if (end > horizon) continue;
    if (end < today) continue;
    if (excludeSettled && c.renewalStatus) {
      if (SETTLED_MARKERS.some((m) => c.renewalStatus!.includes(m))) continue;
    }
    if (opts.storeName && c.storeName !== opts.storeName) continue;
    if (opts.contractType && c.contractType !== opts.contractType) continue;

    const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    rows.push({ ...c, daysUntilExpiry: days });
  }
  rows.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return rows;
}

/** 계약형태 × 지점 요약. */
export async function getContractsBreakdown(): Promise<{
  byContractType: Record<string, number>;
  byStore: Record<string, number>;
}> {
  const byContractType: Record<string, number> = {};
  const byStore: Record<string, number> = {};
  for (const c of await getTenantContracts()) {
    byContractType[c.contractType] = (byContractType[c.contractType] ?? 0) + 1;
    byStore[c.storeName] = (byStore[c.storeName] ?? 0) + 1;
  }
  return { byContractType, byStore };
}
