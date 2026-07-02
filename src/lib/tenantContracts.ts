import "server-only";
import fs from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────
// 입점업체 계약 마스터 로더
//
// contractdata/tenant-contracts-master-*.tsv (ERP 붙여넣기 스냅샷) 을 서버에서 1회 로드.
// 붙여넣기 과정에서 원본 탭이 스페이스로 뭉개져서 컬럼 경계가 흐트러졌기 때문에,
// 헤더 인덱스 기반 파싱 대신 각 행에서 앵커 패턴(날짜/사업자번호/계약번호/enum)으로
// 필요한 필드만 뽑아낸다. ERP에서 원본 xlsx/진짜 TSV가 다시 나오면 스키마 기반 파서로 교체.
// ─────────────────────────────────────────────────────────────

const CONTRACTDATA_DIR = path.join(process.cwd(), "contractdata");

export type ContractType =
  | "임대갑"
  | "임대을"
  | "임대갑(단기)"
  | "임대을(단기)"
  | "판매분특정"
  | "판매분특정(단기)";

const CONTRACT_TYPES: ReadonlySet<string> = new Set([
  "임대갑",
  "임대을",
  "임대갑(단기)",
  "임대을(단기)",
  "판매분특정",
  "판매분특정(단기)",
]);

const RENEWAL_KEYWORDS = [
  "자동연장",
  "재계약",
  "중도퇴점",
  "퇴점",
  "종료",
  "연장",
  "신규",
  "갱신",
  "만료",
  "휴점",
  "오픈",
  "검토중",
  "3개월",
  "6개월",
  "1개월",
  "2개월",
];

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
  source: string;         // 파일명
  importedAt: string;     // 파일 mtime ISO
  contracts: TenantContract[];
}

let cache: Loaded | null = null;

// ── logical row reconstruction ────────────────────────────────
function splitLogicalRows(text: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuote = !inQuote;
      cur += ch;
    } else if (ch === "\n" && !inQuote) {
      rows.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) rows.push(cur);
  return rows;
}

function splitFields(row: string): string[] {
  // 2+ 스페이스를 구분자로. 스프레드시트 붙여넣기 결과라 정규 CSV/TSV가 아님.
  return row
    .split(/ {2,}/)
    .map((f) => f.trim().replace(/^"+|"+$/g, "").trim())
    .filter((f) => f.length > 0);
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_BIZ = /^\d{10}$/;
const RE_CONTRACT_NUM = /^\d{14}$/;
const RE_PHONE = /^(01\d-?\d{3,4}-?\d{4}|0\d{1,2}-\d{3,4}-\d{4}|\d{10,11})$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PLANT = /^\d{4}$/;

function pickRenewalStatus(fields: string[], afterIndex: number): string | null {
  // 갱신 컬럼은 년/월/일 (숫자 3개) 다음에 옴. 열거값 매치.
  for (let i = afterIndex; i < Math.min(fields.length, afterIndex + 6); i++) {
    const f = fields[i];
    for (const kw of RENEWAL_KEYWORDS) {
      if (f.includes(kw)) return f;
    }
  }
  return null;
}

function parseRow(fields: string[]): TenantContract | null {
  if (fields.length < 8) return null;
  const plantCode = fields[0];
  if (!RE_PLANT.test(plantCode)) return null;

  const storeName = fields[1];
  const contractTypeRaw = fields[2];
  if (!CONTRACT_TYPES.has(contractTypeRaw)) return null;

  const floor = fields[3] ?? null;
  const purchaseGroup = fields[4] ?? null;
  const purchaseCode = fields[5] ?? null;
  const purchaseName = fields[6] ?? null;
  const brand = fields[7] ?? "";
  const representative = fields[8] ?? null;

  // 날짜/사업자번호/계약번호 위치 스캔
  const dateIndices: number[] = [];
  let bizIndex = -1;
  let contractNumIndex = -1;
  let emailIndex = -1;
  let phoneIndex = -1;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (RE_DATE.test(f)) dateIndices.push(i);
    else if (bizIndex < 0 && RE_BIZ.test(f)) bizIndex = i;
    else if (contractNumIndex < 0 && RE_CONTRACT_NUM.test(f)) contractNumIndex = i;
    else if (emailIndex < 0 && RE_EMAIL.test(f)) emailIndex = i;
    else if (phoneIndex < 0 && RE_PHONE.test(f.replace(/\s/g, ""))) phoneIndex = i;
  }

  // 헤더 순서: 최초계약일, [영업기간], 계약시작일, 계약만료일, 년, 월, 일, 갱신
  const firstContractDate = dateIndices[0] != null ? fields[dateIndices[0]] : null;
  const contractStartDate = dateIndices[1] != null ? fields[dateIndices[1]] : null;
  const contractEndDate = dateIndices[2] != null ? fields[dateIndices[2]] : null;

  // 갱신은 계약만료일 다음 (년/월/일 스킵) — 3~5 필드 뒤
  let renewalStatus: string | null = null;
  if (dateIndices[2] != null) {
    renewalStatus = pickRenewalStatus(fields, dateIndices[2] + 1);
  }

  // 담당자/연락처: 오른쪽 끝 근처. email/phone 앞의 한글 이름 후보를 담당자로.
  let contactPerson: string | null = null;
  if (phoneIndex > 0 || emailIndex > 0) {
    const anchor = phoneIndex > 0 ? phoneIndex : emailIndex;
    for (let i = anchor - 1; i >= Math.max(0, anchor - 3); i--) {
      const f = fields[i];
      if (/^[가-힣]{2,5}$/.test(f)) {
        contactPerson = f;
        break;
      }
    }
  }

  return {
    plantCode,
    storeName,
    contractType: contractTypeRaw,
    floor,
    purchaseGroup,
    purchaseCode,
    purchaseName,
    brand,
    representative,
    firstContractDate,
    contractStartDate,
    contractEndDate,
    renewalStatus,
    businessId: bizIndex >= 0 ? fields[bizIndex] : null,
    contractNumber: contractNumIndex >= 0 ? fields[contractNumIndex] : null,
    md: null,             // 파싱 신뢰도 낮아 MVP 스킵
    storeManager: null,   // 파싱 신뢰도 낮아 MVP 스킵
    contactPerson,
    phone: phoneIndex >= 0 ? fields[phoneIndex] : null,
    email: emailIndex >= 0 ? fields[emailIndex] : null,
  };
}

function findLatestTsv(): { file: string; mtimeMs: number } | null {
  if (!fs.existsSync(CONTRACTDATA_DIR)) return null;
  const entries = fs.readdirSync(CONTRACTDATA_DIR);
  const candidates = entries
    .filter((f) => /^tenant-contracts-master-.*\.tsv$/i.test(f))
    .map((f) => {
      const full = path.join(CONTRACTDATA_DIR, f);
      const stat = fs.statSync(full);
      return { file: full, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] ?? null;
}

function load(): Loaded {
  if (cache) return cache;
  const found = findLatestTsv();
  if (!found) {
    cache = { source: "", importedAt: new Date().toISOString(), contracts: [] };
    return cache;
  }
  const text = fs.readFileSync(found.file, "utf-8");
  const rows = splitLogicalRows(text);
  const contracts: TenantContract[] = [];
  // 첫 줄이 헤더 — 스킵
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i].trim();
    if (!line || line.startsWith("#N/A")) continue;
    const fields = splitFields(line);
    const rec = parseRow(fields);
    if (rec) contracts.push(rec);
  }
  cache = {
    source: path.basename(found.file),
    importedAt: new Date(found.mtimeMs).toISOString(),
    contracts,
  };
  return cache;
}

// ── public API ────────────────────────────────────────────────

export function getTenantContracts(): TenantContract[] {
  return load().contracts;
}

export function getTenantContractsMeta(): { source: string; importedAt: string; count: number } {
  const l = load();
  return { source: l.source, importedAt: l.importedAt, count: l.contracts.length };
}

function normalizeBrand(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]【】,·・‧,、。.\-_/&+]/g, "");
}

/** 브랜드명·구매처명·상호 유사매칭. 미팅 카드 프리필용. */
export function findContractsByBrand(brand: string, opts?: { includeExpired?: boolean }): TenantContract[] {
  const q = normalizeBrand(brand);
  if (!q) return [];
  const all = getTenantContracts();
  const today = new Date().toISOString().slice(0, 10);
  const hits = all.filter((c) => {
    const b = normalizeBrand(c.brand);
    const p = c.purchaseName ? normalizeBrand(c.purchaseName) : "";
    return b === q || p === q || b.includes(q) || q.includes(b) || p.includes(q);
  });
  const filtered = opts?.includeExpired
    ? hits
    : hits.filter((c) => !c.contractEndDate || c.contractEndDate >= today);
  // 최신 계약(만료일 늦은 것) 순
  return filtered.sort((a, b) => (b.contractEndDate ?? "").localeCompare(a.contractEndDate ?? ""));
}

export function findContractsByBusinessId(bizId: string): TenantContract[] {
  const q = bizId.replace(/\D/g, "");
  if (q.length !== 10) return [];
  return getTenantContracts().filter((c) => c.businessId === q);
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
export function getExpiringContracts(opts: ExpiringOpts = {}): (TenantContract & { daysUntilExpiry: number })[] {
  const withinDays = opts.withinDays ?? 60;
  const excludeSettled = opts.excludeSettled ?? true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + withinDays);

  const rows: (TenantContract & { daysUntilExpiry: number })[] = [];
  for (const c of getTenantContracts()) {
    if (!c.contractEndDate) continue;
    const end = new Date(c.contractEndDate + "T00:00:00");
    if (!Number.isFinite(end.getTime())) continue;
    if (end > horizon) continue;
    if (end < today) continue; // 이미 만료된 건 별도 뷰에서
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

/** 계약형태 × 지점 요약 (계약형태별 집계 대시보드 용도의 기반) */
export function getContractsBreakdown(): {
  byContractType: Record<string, number>;
  byStore: Record<string, number>;
} {
  const byContractType: Record<string, number> = {};
  const byStore: Record<string, number> = {};
  for (const c of getTenantContracts()) {
    byContractType[c.contractType] = (byContractType[c.contractType] ?? 0) + 1;
    byStore[c.storeName] = (byStore[c.storeName] ?? 0) + 1;
  }
  return { byContractType, byStore };
}
