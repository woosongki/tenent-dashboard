import "server-only";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

// 네이버 검색광고(Search Ad) keywordstool 자동수집 — C4(수준)·C5(전년 동월 대비) (PRD P4).
//   C4 = 이번 달 절대 검색수(PC+모바일) 합. ※ 데이터랩 상대지수(0~100) 사용 금지(PRD 04.3절).
//   C5 = (이번 달 − 전년 동월) / 전년 동월 × 100. bcd_search_volume에 전년 동월 데이터 없으면 N/A(시계열부족).
//
// 인증: HMAC-SHA256. message = `${timestamp}.${method}.${path}`, key = SECRET_KEY.
//   헤더 X-Timestamp · X-API-KEY(액세스 라이선스) · X-Customer(고객 ID) · X-Signature(base64).
// 키: NAVER_AD_API_KEY · NAVER_AD_SECRET_KEY · NAVER_AD_CUSTOMER_ID.
//
// ⚠ 원격 에이전트 환경은 외부 API 프록시 403 → 여기서 실행 불가. 배포본/로컬에서 호출.

const BASE = "https://api.searchad.naver.com";
const PATH = "/keywordstool";

export interface NaverAdCreds { apiKey: string; secretKey: string; customerId: string }

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
  // 네이버는 hintKeywords의 공백을 제거해 처리 — 최대 5개.
  const kws = hintKeywords.map((k) => k.replace(/\s+/g, "")).filter(Boolean).slice(0, 5);
  if (kws.length === 0) return [];
  const ts = String(Date.now());
  const signature = sign(ts, "GET", PATH, creds.secretKey);
  const url = `${BASE}${PATH}?hintKeywords=${encodeURIComponent(kws.join(","))}&showDetail=1`;
  const res = await fetch(url, {
    headers: {
      "X-Timestamp": ts,
      "X-API-KEY": creds.apiKey,
      "X-Customer": creds.customerId,
      "X-Signature": signature,
    },
  });
  if (!res.ok) throw new Error(`네이버검색광고 ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const data = (await res.json()) as { keywordList?: KeywordRow[] };
  return data.keywordList ?? [];
}

interface BrandLite { id: string; name: string; search_keywords: string[] }

export interface NaverRunSummary {
  runId: string | null;
  brandsTotal: number;
  brandsOk: number;
  ym: string;
  errors: { brand: string; error: string }[];
}

/** 네이버 검색광고 자동수집 실행. brandIds 미지정 시 활성 브랜드 전체(최대 limit건). */
export async function runNaverCollection(opts: {
  creds: NaverAdCreds;
  triggeredBy: string;
  brandIds?: string[];
  limit?: number;
}): Promise<NaverRunSummary> {
  const svc = createServiceClient();

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevYm = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let bq = svc.from("bcd_brands").select("id, name, search_keywords").eq("scope_status", "active");
  if (opts.brandIds?.length) bq = bq.in("id", opts.brandIds);
  bq = bq.order("name", { ascending: true }).limit(opts.limit ?? 30);
  const { data: brandsRaw, error: bErr } = await bq;
  if (bErr) throw new Error(`brands 조회 실패: ${bErr.message}`);
  const brands = (brandsRaw ?? []) as BrandLite[];

  const { data: runRow } = await svc
    .from("bcd_snapshot_runs")
    .insert({ run_type: "naver_search", status: "running", triggered_by: opts.triggeredBy, brands_total: brands.length })
    .select("id").single();
  const runId = (runRow?.id as string | undefined) ?? null;

  const errors: { brand: string; error: string }[] = [];
  let ok = 0;

  for (const brand of brands) {
    try {
      const keywords = (brand.search_keywords?.length ? brand.search_keywords : [brand.name]).slice(0, 5);
      const rows = await keywordstool(keywords, opts.creds);
      const byKw = new Map(rows.map((r) => [norm(r.relKeyword), r]));

      let pcSum = 0, mobileSum = 0;
      const volRows: Record<string, unknown>[] = [];
      for (const kw of keywords) {
        const r = byKw.get(norm(kw));
        const pc = parseCount(r?.monthlyPcQcCnt);
        const mobile = parseCount(r?.monthlyMobileQcCnt);
        pcSum += pc; mobileSum += mobile;
        volRows.push({ brand_id: brand.id, keyword: kw.replace(/\s+/g, ""), ym, pc, mobile, source: "naver_ads" });
      }
      // 검색량 시계열 저장(중복 시 갱신)
      if (volRows.length) await svc.from("bcd_search_volume").upsert(volRows, { onConflict: "brand_id,keyword,ym" });

      const c4 = pcSum + mobileSum;

      // C5 전년 동월 대비 — 저장된 전년 동월 검색량 합
      const { data: prevVol } = await svc
        .from("bcd_search_volume").select("total").eq("brand_id", brand.id).eq("ym", prevYm);
      const prevTotal = ((prevVol ?? []) as { total: number | null }[]).reduce((t, r) => t + (r.total ?? 0), 0);

      const metricRows: Record<string, unknown>[] = [
        { brand_id: brand.id, metric_code: "C4", value: c4, source: "naver_ads", snapshot_run_id: runId, checked_by: opts.triggeredBy, detail: { ym, keywords } },
      ];
      if (prevTotal > 0) {
        const c5 = Math.round(((c4 - prevTotal) / prevTotal) * 1000) / 10;
        metricRows.push({ brand_id: brand.id, metric_code: "C5", value: c5, source: "naver_ads", snapshot_run_id: runId, checked_by: opts.triggeredBy, detail: { ym, prevYm } });
      } else {
        metricRows.push({ brand_id: brand.id, metric_code: "C5", value: null, na_reason: "시계열부족", source: "naver_ads", snapshot_run_id: runId, checked_by: opts.triggeredBy });
      }

      await svc.from("bcd_metric_values").insert(metricRows);
      ok++;
    } catch (e) {
      errors.push({ brand: brand.name, error: e instanceof Error ? e.message : String(e) });
    }
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
