import "server-only";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

// 네이버 검색 자동수집 — C4(수준)·C5(추세) (PRD P4).
//   C4 = 검색광고 keywordstool 절대 검색수(PC+모바일). ※ C4는 절대값이어야 함(데이터랩 상대지수 금지).
//   C5 = 데이터랩(검색어트렌드) 전년 동월 대비 증감률(%). 같은 키워드의 월별 비율은 상대지수여도
//        정규화 무관하게 정확 → keywordstool과 달리 13개월 시계열이 있어 지금 바로 계산 가능.
//
// 검색광고 인증: HMAC-SHA256. message=`${ts}.${method}.${path}`, key=SECRET_KEY.
//   헤더 X-Timestamp·X-API-KEY·X-Customer·X-Signature. 키: NAVER_AD_API_KEY·NAVER_AD_SECRET_KEY·NAVER_AD_CUSTOMER_ID.
// 데이터랩 인증: X-Naver-Client-Id/Secret. 키: NAVER_SEARCH_CLIENT_ID·NAVER_SEARCH_CLIENT_SECRET(앱에 데이터랩 scope 필요).
//
// 신뢰성: 브랜드마다 호출 사이 지연 + 실패 시 재시도(레이트리밋 완화).
// ⚠ 원격 에이전트 환경은 외부 API 프록시 403 → 여기서 실행 불가. 배포본/로컬에서 호출.

const AD_BASE = "https://api.searchad.naver.com";
const AD_PATH = "/keywordstool";
const DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";

export interface NaverAdCreds {
  apiKey: string;
  secretKey: string;
  customerId: string;
  datalabId?: string;     // 데이터랩(C5)용 — 없으면 C5는 N/A
  datalabSecret?: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { last = e; await delay(400 * (i + 1)); }
  }
  throw last;
}

function sign(timestamp: string, method: string, path: string, secretKey: string): string {
  return crypto.createHmac("sha256", secretKey).update(`${timestamp}.${method}.${path}`).digest("base64");
}

interface KeywordRow {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
}

/** "< 10" 등 문자열/숫자 혼재 → 숫자. "<"로 시작하면 임계 미만이라 0으로(하위 랭크). */
function parseCount(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v.trim().startsWith("<")) return 0;
  const n = Number(v.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

async function keywordstool(hintKeywords: string[], creds: NaverAdCreds): Promise<KeywordRow[]> {
  const kws = hintKeywords.map((k) => k.replace(/\s+/g, "")).filter(Boolean).slice(0, 5);
  if (kws.length === 0) return [];
  const ts = String(Date.now());
  const signature = sign(ts, "GET", AD_PATH, creds.secretKey);
  const url = `${AD_BASE}${AD_PATH}?hintKeywords=${encodeURIComponent(kws.join(","))}&showDetail=1`;
  const res = await fetch(url, {
    headers: {
      "X-Timestamp": ts,
      "X-API-KEY": creds.apiKey,
      "X-Customer": creds.customerId,
      "X-Signature": signature,
    },
  });
  if (!res.ok) throw new Error(`검색광고 ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = (await res.json()) as { keywordList?: KeywordRow[] };
  return data.keywordList ?? [];
}

/** 데이터랩 검색트렌드로 전년 동월 대비 증감률(%). 계산 불가 시 null. */
async function datalabYoY(keywords: string[], clientId: string, clientSecret: string): Promise<number | null> {
  const kws = keywords.filter(Boolean).slice(0, 5);
  if (kws.length === 0) return null;
  const end = new Date();
  const start = new Date();
  start.setMonth(end.getMonth() - 13);
  const body = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    timeUnit: "month",
    keywordGroups: [{ groupName: kws[0], keywords: kws }],
  };
  const res = await fetch(DATALAB_URL, {
    method: "POST",
    headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`데이터랩 ${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
  const data = (await res.json()) as { results?: { data?: { period: string; ratio: number }[] }[] };
  const series = data.results?.[0]?.data ?? [];
  if (series.length === 0) return null;
  const nowYm = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
  const map = new Map(series.map((p) => [p.period.slice(0, 7), p.ratio]));
  // 현재(부분)월 제외 → 완결된 직전 월끼리 전년 동월 비교(부분월 하향 왜곡 방지).
  const months = [...map.keys()].filter((m) => m < nowYm).sort();
  if (months.length === 0) return null;
  const latest = months[months.length - 1];
  const [ly, lm] = latest.split("-").map(Number);
  const prevKey = `${ly - 1}-${String(lm).padStart(2, "0")}`;
  const cur = map.get(latest) ?? 0;
  const prev = map.get(prevKey);
  if (prev === undefined || prev <= 0) return null; // 전년 동월 데이터 없음 → 시계열부족
  return Math.round(((cur / prev - 1) * 100) * 10) / 10;
}

interface BrandLite { id: string; name: string; search_keywords: string[] }

export interface NaverRunSummary {
  runId: string | null;
  brandsTotal: number;
  brandsOk: number;
  ym: string;
  errors: { brand: string; error: string }[];
}

/** 네이버 자동수집 실행. brandIds 미지정 시 활성 브랜드 전체(최대 limit건). */
export async function runNaverCollection(opts: {
  creds: NaverAdCreds;
  triggeredBy: string;
  brandIds?: string[];
  limit?: number;
}): Promise<NaverRunSummary> {
  const svc = createServiceClient();

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let bq = svc.from("bcd_brands").select("id, name, search_keywords").eq("scope_status", "active");
  if (opts.brandIds?.length) bq = bq.in("id", opts.brandIds);
  bq = bq.order("name", { ascending: true }).limit(opts.limit ?? 15);
  const { data: brandsRaw, error: bErr } = await bq;
  if (bErr) throw new Error(`brands 조회 실패: ${bErr.message}`);
  const brands = (brandsRaw ?? []) as BrandLite[];

  const { data: runRow } = await svc
    .from("bcd_snapshot_runs")
    .insert({ run_type: "naver_search", status: "running", triggered_by: opts.triggeredBy, brands_total: brands.length })
    .select("id").single();
  const runId = (runRow?.id as string | undefined) ?? null;
  const hasDatalab = !!(opts.creds.datalabId && opts.creds.datalabSecret);

  const errors: { brand: string; error: string }[] = [];
  let ok = 0;

  const emsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  for (const brand of brands) {
    const keywords = (brand.search_keywords?.length ? brand.search_keywords : [brand.name]).slice(0, 5);

    // C4(검색광고)·C5(데이터랩)를 병렬 호출 — 서로 독립. 하나 실패해도 다른 건 기록.
    const [c4r, c5r] = await Promise.allSettled([
      withRetry(() => keywordstool(keywords, opts.creds), 2),
      hasDatalab
        ? withRetry(() => datalabYoY(keywords, opts.creds.datalabId!, opts.creds.datalabSecret!), 2)
        : Promise.resolve<number | null>(null),
    ]);

    const metricRows: Record<string, unknown>[] = [];
    const errParts: string[] = [];

    // C4
    if (c4r.status === "fulfilled") {
      const byKw = new Map(c4r.value.map((r) => [norm(r.relKeyword), r]));
      let pcSum = 0, mobileSum = 0;
      const volRows: Record<string, unknown>[] = [];
      for (const kw of keywords) {
        const r = byKw.get(norm(kw));
        const pc = parseCount(r?.monthlyPcQcCnt);
        const mobile = parseCount(r?.monthlyMobileQcCnt);
        pcSum += pc; mobileSum += mobile;
        volRows.push({ brand_id: brand.id, keyword: kw.replace(/\s+/g, ""), ym, pc, mobile, source: "naver_ads" });
      }
      if (volRows.length) await svc.from("bcd_search_volume").upsert(volRows, { onConflict: "brand_id,keyword,ym" });
      metricRows.push({ brand_id: brand.id, metric_code: "C4", value: pcSum + mobileSum, source: "naver_ads", snapshot_run_id: runId, checked_by: opts.triggeredBy, detail: { ym, keywords } });
    } else {
      errParts.push(`C4:${emsg(c4r.reason)}`);
    }

    // C5 (데이터랩 있을 때만 기록)
    if (hasDatalab) {
      const c5 = c5r.status === "fulfilled" ? c5r.value : null;
      if (c5r.status === "rejected") errParts.push(`C5:${emsg(c5r.reason)}`);
      if (c5 !== null) {
        metricRows.push({ brand_id: brand.id, metric_code: "C5", value: c5, source: "naver_datalab", snapshot_run_id: runId, checked_by: opts.triggeredBy, detail: { ym, yoy: true } });
      } else {
        metricRows.push({ brand_id: brand.id, metric_code: "C5", value: null, na_reason: "시계열부족", source: "naver_datalab", snapshot_run_id: runId, checked_by: opts.triggeredBy });
      }
    }

    if (metricRows.length) await svc.from("bcd_metric_values").insert(metricRows);
    if (metricRows.length) ok++;
    else errors.push({ brand: brand.name, error: errParts.join(" / ") || "기록 없음" });

    await delay(120); // 브랜드 간 간격 — 레이트리밋 완화
  }

  if (runId) {
    await svc.from("bcd_snapshot_runs").update({
      status: errors.length ? "review" : "completed",
      finished_at: new Date().toISOString(),
      brands_ok: ok, brands_review: errors.length,
      note: errors.length ? `${errors.length}개 브랜드 오류` : null,
    }).eq("id", runId);
  }

  return { runId, brandsTotal: brands.length, brandsOk: ok, ym, errors };
}
