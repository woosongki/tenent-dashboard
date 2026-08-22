import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

// 카카오맵 Local REST API 자동수집 — C1·C2·C3·C6 채움 (PRD P3).
//   C3 전국 매장 수 = 브랜드 키워드로 검색된 고유 장소 수
//   C1 벤치마크 입점률 = (입점 확인된 full-survey 벤치마크 몰 수 ÷ 전체 full-survey 몰 수) × 100
//   C2 핫플 상권 입점 수 = 주소가 hotspot match_strings와 매칭되는 고유 장소 수 (hotspot 목록 없으면 N/A)
//   C6 매장 수 순증률 = (이번 C3 − 직전 카카오 회차 C3) / 직전 C3 × 100 (첫 회차 N/A)
//
// ⚠ 이 원격 에이전트 환경은 외부 API 프록시 403 → 여기서 실 호출 불가.
//   배포본(Vercel) 또는 로컬 실행에서 동작. 키: KAKAO_REST_API_KEY (카카오 개발자콘솔 → REST API 키).

const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const PAGE_SIZE = 15;   // 카카오 최대 15
const MAX_PAGES = 3;    // 브랜드·키워드당 최대 45건 (비용·시간 보호)

interface KakaoDoc {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // lng
  y: string; // lat
  category_name: string;
}
interface KakaoResp {
  documents: KakaoDoc[];
  meta: { total_count: number; pageable_count: number; is_end: boolean };
}

async function kakaoSearch(query: string, restKey: string): Promise<KakaoDoc[]> {
  const out: KakaoDoc[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${KAKAO_KEYWORD_URL}?query=${encodeURIComponent(query)}&size=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` } });
    if (!res.ok) throw new Error(`카카오 ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 200));
    const data = (await res.json()) as KakaoResp;
    out.push(...(data.documents ?? []));
    if (data.meta?.is_end || page * PAGE_SIZE >= (data.meta?.pageable_count ?? 0)) break;
  }
  return out;
}

interface BrandLite { id: string; name: string; search_keywords: string[] }
interface ListRow { name: string; match_strings: string[]; is_full_survey: boolean }

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
function matchesAny(hay: string, needles: string[]): boolean {
  const h = norm(hay);
  return needles.some((n) => n && h.includes(norm(n)));
}

export interface KakaoRunSummary {
  runId: string | null;
  brandsTotal: number;
  brandsOk: number;
  errors: { brand: string; error: string }[];
}

/** 카카오 자동수집 실행. brandIds 미지정 시 활성 브랜드 전체(최대 limit건). */
export async function runKakaoCollection(opts: {
  restKey: string;
  triggeredBy: string;
  brandIds?: string[];
  limit?: number;
}): Promise<KakaoRunSummary> {
  const svc = createServiceClient();

  let bq = svc.from("bcd_brands").select("id, name, search_keywords").eq("scope_status", "active");
  if (opts.brandIds?.length) bq = bq.in("id", opts.brandIds);
  bq = bq.order("name", { ascending: true }).limit(opts.limit ?? 30);
  const { data: brandsRaw, error: bErr } = await bq;
  if (bErr) throw new Error(`brands 조회 실패: ${bErr.message}`);
  const brands = (brandsRaw ?? []) as BrandLite[];

  const { data: lists } = await svc.from("bcd_lists").select("list_type, name, match_strings, is_full_survey");
  const benchmarks = ((lists ?? []) as (ListRow & { list_type: string })[]).filter((l) => l.list_type === "benchmark");
  const fullSurvey = benchmarks.filter((b) => b.is_full_survey);
  const hotspots = ((lists ?? []) as (ListRow & { list_type: string })[]).filter((l) => l.list_type === "hotspot");

  // 직전 카카오 회차의 브랜드별 C3 (C6 순증률 계산용)
  const prevC3 = new Map<string, number>();
  {
    const { data: prevRun } = await svc
      .from("bcd_snapshot_runs").select("id").eq("run_type", "kakao_store").eq("status", "completed")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (prevRun?.id) {
      const { data: prevMetrics } = await svc
        .from("bcd_metric_values").select("brand_id, value").eq("metric_code", "C3").eq("snapshot_run_id", prevRun.id);
      for (const m of (prevMetrics ?? []) as { brand_id: string; value: number | null }[]) {
        if (m.value != null) prevC3.set(m.brand_id, m.value);
      }
    }
  }

  const { data: runRow } = await svc
    .from("bcd_snapshot_runs")
    .insert({ run_type: "kakao_store", status: "running", triggered_by: opts.triggeredBy, brands_total: brands.length })
    .select("id").single();
  const runId = (runRow?.id as string | undefined) ?? null;

  const errors: { brand: string; error: string }[] = [];
  let ok = 0;

  for (const brand of brands) {
    try {
      const keywords = brand.search_keywords?.length ? brand.search_keywords : [brand.name];
      const byId = new Map<string, KakaoDoc>();
      for (const kw of keywords) {
        for (const doc of await kakaoSearch(kw, opts.restKey)) byId.set(doc.id, doc);
      }
      const places = [...byId.values()];
      const c3 = places.length;

      // 스냅샷 저장
      if (runId && places.length) {
        await svc.from("bcd_store_snapshots").insert(
          places.map((p) => ({
            snapshot_run_id: runId, brand_id: brand.id,
            place_name: p.place_name, place_id: p.id,
            lat: Number(p.y) || null, lng: Number(p.x) || null,
            is_mall: /몰|아울렛|백화점|스타필드|타임스퀘어|코엑스/.test(p.place_name + p.road_address_name),
            raw: p as unknown as Record<string, unknown>,
          }))
        );
      }

      // C1 벤치마크 입점률
      let c1: number | null = null;
      if (fullSurvey.length > 0) {
        const matchedMalls = fullSurvey.filter((mall) =>
          places.some((p) => matchesAny(`${p.place_name} ${p.road_address_name} ${p.address_name}`, mall.match_strings.length ? mall.match_strings : [mall.name]))
        ).length;
        c1 = Math.round((matchedMalls / fullSurvey.length) * 100);
      }

      // C2 핫플 입점 수 (hotspot 목록 있을 때만)
      let c2: number | null = null;
      let c2Na = false;
      if (hotspots.length > 0) {
        c2 = places.filter((p) =>
          hotspots.some((h) => matchesAny(`${p.road_address_name} ${p.address_name}`, h.match_strings.length ? h.match_strings : [h.name]))
        ).length;
      } else {
        c2Na = true;
      }

      // C6 매장 수 순증률
      let c6: number | null = null;
      let c6Na = false;
      const prior = prevC3.get(brand.id);
      if (prior && prior > 0) c6 = Math.round(((c3 - prior) / prior) * 1000) / 10;
      else c6Na = true;

      // 지표 기록
      const rows: Record<string, unknown>[] = [
        { brand_id: brand.id, metric_code: "C3", value: c3, source: "kakao_map", snapshot_run_id: runId, checked_by: opts.triggeredBy, detail: { keywords } },
      ];
      if (c1 !== null) rows.push({ brand_id: brand.id, metric_code: "C1", value: c1, source: "kakao_map", snapshot_run_id: runId, checked_by: opts.triggeredBy });
      if (c2 !== null) rows.push({ brand_id: brand.id, metric_code: "C2", value: c2, source: "kakao_map", snapshot_run_id: runId, checked_by: opts.triggeredBy });
      else if (c2Na) rows.push({ brand_id: brand.id, metric_code: "C2", value: null, na_reason: "표본부족", source: "kakao_map", snapshot_run_id: runId, checked_by: opts.triggeredBy });
      if (c6 !== null) rows.push({ brand_id: brand.id, metric_code: "C6", value: c6, source: "kakao_map", snapshot_run_id: runId, checked_by: opts.triggeredBy });
      else if (c6Na) rows.push({ brand_id: brand.id, metric_code: "C6", value: null, na_reason: "시계열부족", source: "kakao_map", snapshot_run_id: runId, checked_by: opts.triggeredBy });

      await svc.from("bcd_metric_values").insert(rows);
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

  return { runId, brandsTotal: brands.length, brandsOk: ok, errors };
}
