import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import type {
  DartCompany,
  FinancialYear,
  DartDisclosure,
  MajorShareholder,
} from "./types";

const DART_BASE = "https://opendart.fss.or.kr/api";

function dartKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY 환경변수가 설정되지 않았습니다");
  return key;
}

// ── Corp Code 캐시 ────────────────────────────────────────────────
interface CorpEntry {
  code: string;
  name: string;
  stockCode: string;
}

let corpCache: CorpEntry[] | null = null;

function loadCorpCache(): CorpEntry[] {
  if (corpCache) return corpCache;
  const filePath = join(process.cwd(), "src", "data", "dart", "corp-codes.json");
  try {
    const raw = readFileSync(filePath, "utf-8");
    corpCache = JSON.parse(raw) as CorpEntry[];
    return corpCache;
  } catch {
    return [];
  }
}

export interface CorpCandidate {
  code: string;
  name: string;
  stockCode: string | null;
  matchType: "exact" | "startsWith" | "contains" | "reverse";
  ceoName?: string | null;       // DART에서 비동기로 채워짐
  estDate?: string | null;       // 설립일 YYYYMMDD
  industry?: string | null;      // 업종코드
}

/**
 * 후보 목록에 대표자명을 비동기로 채워 넣음 (DART company.json 병렬 호출)
 * UI에서 동명이인·계열사 구분을 위해 사용
 */
export async function enrichCandidates(candidates: CorpCandidate[]): Promise<CorpCandidate[]> {
  const results = await Promise.all(
    candidates.map(async (c) => {
      const info = await fetchCompanyInfo(c.code);
      return {
        ...c,
        ceoName: info?.repName ?? null,
        estDate: info?.est_dt ?? null,
        industry: info?.induty_code ?? null,
      };
    })
  );
  return results;
}

/**
 * 회사명으로 매칭되는 후보 목록을 반환 (UI에서 사용자가 선택 가능)
 * 정렬: matchType 우선순위 → 상장사 우선 → 이름 짧은 순
 */
export function searchCorpCandidates(companyName: string, limit = 30): CorpCandidate[] {
  const corps = loadCorpCache();
  if (corps.length === 0) return [];
  const q = companyName.trim();
  if (!q) return [];

  const seen = new Set<string>();
  const candidates: CorpCandidate[] = [];

  function push(entry: CorpEntry, matchType: CorpCandidate["matchType"]) {
    if (seen.has(entry.code)) return;
    seen.add(entry.code);
    candidates.push({
      code: entry.code,
      name: entry.name,
      stockCode: entry.stockCode || null,
      matchType,
    });
  }

  const sortFn = (a: CorpEntry, b: CorpEntry) => {
    const sa = a.stockCode ? 0 : 1;
    const sb = b.stockCode ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.name.length - b.name.length;
  };

  // 1) 완전 일치
  corps.filter((c) => c.name === q).sort(sortFn).forEach((c) => push(c, "exact"));

  // 2) 시작 일치
  corps.filter((c) => c.name.startsWith(q) && c.name !== q).sort(sortFn).forEach((c) => push(c, "startsWith"));

  // 3) 포함
  corps.filter((c) => c.name.includes(q) && !c.name.startsWith(q)).sort(sortFn).forEach((c) => push(c, "contains"));

  // 4) 역방향 포함 (쿼리가 등록명을 포함)
  corps
    .filter((c) => c.name.length >= 3 && q.includes(c.name) && !c.name.includes(q))
    .sort((a, b) => b.name.length - a.name.length)
    .forEach((c) => push(c, "reverse"));

  return candidates.slice(0, limit);
}

export function searchCorpCode(companyName: string): CorpEntry | null {
  const corps = loadCorpCache();
  if (corps.length === 0) return null;
  const q = companyName.trim();

  // 1) 완전 일치 (동명이인 여러 개 있을 수 있으므로 상장사 우선)
  const exacts = corps.filter((c) => c.name === q);
  if (exacts.length > 0) {
    const listed = exacts.find((c) => c.stockCode);
    return listed ?? exacts[0];
  }

  // 2) 등록명이 검색어로 시작 (예: "쿠팡" → "쿠팡", "쿠팡페이"...)
  //    상장사(stockCode 있음) 우선, 그 다음 이름 짧은 순
  const startsWith = corps
    .filter((c) => c.name.startsWith(q))
    .sort((a, b) => {
      const sa = a.stockCode ? 0 : 1;
      const sb = b.stockCode ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.length - b.name.length;
    });
  if (startsWith[0]) return startsWith[0];

  // 3) 등록명이 검색어를 포함 (예: "다이소" → "아성다이소")
  //    상장사 우선, 그 다음 이름 짧은 순
  const contains = corps
    .filter((c) => c.name.includes(q))
    .sort((a, b) => {
      const sa = a.stockCode ? 0 : 1;
      const sb = b.stockCode ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.length - b.name.length;
    });
  if (contains[0]) return contains[0];

  // 4) 마지막 fallback: 검색어가 등록명을 포함 (단, 3자 이상의 의미있는 매치만)
  //    예: "삼성전자서비스" → "삼성전자"
  const reverse = corps
    .filter((c) => c.name.length >= 3 && q.includes(c.name))
    .sort((a, b) => b.name.length - a.name.length); // 긴 것 우선 (더 구체적)
  return reverse[0] ?? null;
}

// ── API 호출 헬퍼 ─────────────────────────────────────────────────
async function dartGet<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${DART_BASE}/${endpoint}`);
  url.searchParams.set("crtfc_key", dartKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url.toString(), { next: { revalidate: 0 } });
      if (!res.ok) throw new Error(`DART HTTP ${res.status}`);
      const json = (await res.json()) as { status: string; message: string } & T;
      if (json.status !== "000" && json.status !== "013") {
        throw new Error(`DART API 오류: ${json.message} (${json.status})`);
      }
      return json;
    } catch (err) {
      lastErr = err;
      if (i < 2) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

// ── 기업 기본정보 ─────────────────────────────────────────────────
interface DartCompanyRaw {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string;
  fndr_dt?: string;
  est_dt?: string;
  hm_url?: string;
  ir_url?: string;
  phn_no?: string;
  fax_no?: string;
  adres?: string;
  bsns_year?: string;
  acc_mt?: string;
  ceo_nm?: string;
  bizr_no?: string;
  jurir_no?: string;
  induty_code?: string;
  induty_nm?: string;
}

export async function fetchCompanyInfo(corpCode: string): Promise<DartCompany | null> {
  try {
    const data = await dartGet<{ corp_code: string } & DartCompanyRaw>("company.json", {
      corp_code: corpCode,
    });
    return {
      corpCode: data.corp_code,
      corpName: data.corp_name,
      stockCode: data.stock_code?.trim() || null,
      corpCls: (data.corp_cls as DartCompany["corpCls"]) ?? null,
      repName: data.ceo_nm ?? null,
      bizrNo: data.bizr_no ?? null,
      jurir_no: data.jurir_no ?? null,
      adres: data.adres ?? null,
      hm_url: data.hm_url ?? null,
      ir_url: data.ir_url ?? null,
      phn_no: data.phn_no ?? null,
      induty_code: data.induty_code ?? null,
      est_dt: data.est_dt ?? data.fndr_dt ?? null,
      acc_mt: data.acc_mt ?? null,
    };
  } catch {
    return null;
  }
}

// ── 재무제표 ──────────────────────────────────────────────────────
interface FinancialItem {
  bsns_year: string;
  account_nm: string;
  fs_div: string;       // CFS=연결, OFS=별도
  sj_div: string;       // BS=재무상태표, IS=손익계산서
  thstrm_amount: string;
}

function findAmount(items: FinancialItem[], names: string[], sjDiv: string, fsDiv?: string): number | null {
  const candidates = items.filter(
    (x) =>
      names.some((n) => x.account_nm.includes(n)) &&
      x.sj_div === sjDiv &&
      (!fsDiv || x.fs_div === fsDiv)
  );
  const item = candidates[0];
  if (!item) return null;
  const n = Number(item.thstrm_amount.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

export async function fetchFinancials(corpCode: string): Promise<FinancialYear[]> {
  const currentYear = new Date().getFullYear();
  const years: FinancialYear[] = [];

  for (let y = currentYear - 1; y >= currentYear - 3; y--) {
    try {
      const data = await dartGet<{ list?: FinancialItem[] }>("fnlttSinglAcnt.json", {
        corp_code: corpCode,
        bsns_year: String(y),
        reprt_code: "11011",
      });
      const items = data.list ?? [];

      // 연결 우선, 없으면 별도
      const pref = items.some((x) => x.fs_div === "CFS") ? "CFS" : "OFS";

      const revenue = findAmount(items, ["매출액", "영업수익", "수익(매출액)"], "IS", pref);
      const opProfit = findAmount(items, ["영업이익"], "IS", pref);
      const netIncome = findAmount(items, ["당기순이익"], "IS", pref);
      const totalAssets = findAmount(items, ["자산총계"], "BS", pref);
      const totalLiabilities = findAmount(items, ["부채총계"], "BS", pref);
      const totalEquity = findAmount(items, ["자본총계"], "BS", pref);
      const currentAssets = findAmount(items, ["유동자산"], "BS", pref);
      const currentLiabilities = findAmount(items, ["유동부채"], "BS", pref);
      const interestExpense = findAmount(items, ["이자비용", "금융비용"], "IS", pref);

      years.push({
        year: y,
        revenue,
        operatingProfit: opProfit,
        netIncome,
        totalAssets,
        totalLiabilities,
        totalEquity,
        currentAssets,
        currentLiabilities,
        interestExpense,
        auditOpinion: null,
      });
    } catch {
      years.push({
        year: y,
        revenue: null,
        operatingProfit: null,
        netIncome: null,
        totalAssets: null,
        totalLiabilities: null,
        totalEquity: null,
        currentAssets: null,
        currentLiabilities: null,
        interestExpense: null,
        auditOpinion: null,
      });
    }
  }
  return years;
}

// ── 공시 이력 ─────────────────────────────────────────────────────
export async function fetchDisclosures(corpCode: string): Promise<DartDisclosure[]> {
  const now = new Date();
  const end = now.toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  try {
    const data = await dartGet<{ list?: Array<Record<string, string>> }>("list.json", {
      corp_code: corpCode,
      bgn_de: start,
      end_de: end,
      pblntf_ty: "A",
      page_count: "50",
    });
    return (data.list ?? []).map((x) => ({
      rceptNo: x.rcept_no,
      corpCode: x.corp_code,
      corpName: x.corp_name,
      rceptDt: x.rcept_dt,
      pblntfTy: x.corp_cls ?? "",
      pblntfTyNm: x.corp_cls === "Y" ? "유가증권" : x.corp_cls === "K" ? "코스닥" : x.corp_cls === "N" ? "코넥스" : "기타",
      rceptNm: x.report_nm,
    }));
  } catch {
    return [];
  }
}

// ── 최대주주 현황 ─────────────────────────────────────────────────
export async function fetchMajorShareholders(corpCode: string): Promise<MajorShareholder[]> {
  const year = String(new Date().getFullYear() - 1);
  try {
    const data = await dartGet<{ list?: MajorShareholder[] }>("majorstock.json", {
      corp_code: corpCode,
      bsns_year: year,
      reprt_code: "11011",
    });
    return data.list ?? [];
  } catch {
    return [];
  }
}
