/**
 * 통계청 SGIS Plus OpenAPI 통합.
 *
 * 흐름:
 *   1) OAuth 토큰 발급 (4시간 유효)
 *   2) 시도/시군구/행정동 코드 조회
 *   3) 인구·세대·연령·성별 통계 조회
 *
 * 빌드 타임 또는 별도 스크립트(scripts/fetch-population.mjs)에서 호출.
 * runtime에 직접 호출하기엔 4시간 토큰 갱신 + rate limit 부담이 있어 정적 JSON으로 캐시 권장.
 */

const BASE = "https://sgisapi.kostat.go.kr/OpenAPI3";

const CONSUMER_KEY    = process.env.SGIS_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.SGIS_CONSUMER_SECRET;

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;

/** OAuth 토큰 발급 (4시간 캐시) */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error("SGIS_CONSUMER_KEY / SGIS_CONSUMER_SECRET 미설정 (.env.local 확인)");
  }

  const url = `${BASE}/auth/authentication.json?consumer_key=${CONSUMER_KEY}&consumer_secret=${CONSUMER_SECRET}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    errCd: number;
    errMsg: string;
    result?: { accessToken: string; accessTimeout: string };
  };
  if (json.errCd !== 0 || !json.result) {
    throw new Error(`SGIS 토큰 발급 실패 (${json.errCd}): ${json.errMsg}`);
  }

  // accessTimeout 은 epoch ms (string)
  const expiresAt = Number(json.result.accessTimeout);
  tokenCache = {
    accessToken: json.result.accessToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : now + 3.5 * 60 * 60 * 1000,
  };
  return tokenCache.accessToken;
}

// ─────────────────────────────────────────────────────────────
// 행정구역 코드 조회
// ─────────────────────────────────────────────────────────────

export interface AdmStageRow {
  cd: string;       // 행정구역코드 (시도 2자리 / 시군구 5자리 / 행정동 8자리)
  addr_name: string;// 이름 ("서울특별시", "강남구", "역삼1동")
  full_addr: string;// 전체 주소
  x?: string;       // UTM-K 또는 WGS84 (api 응답에 따라)
  y?: string;
}

interface StageResponse {
  errCd: number;
  errMsg: string;
  result: AdmStageRow[];
}

/**
 * 행정구역 단계 조회.
 *  - cd 미지정: 전국 시도(17개)
 *  - cd=2자리: 해당 시도의 시군구 목록
 *  - cd=5자리: 해당 시군구의 행정동 목록
 */
export async function getStage(cd?: string): Promise<AdmStageRow[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ accessToken: token });
  if (cd) params.set("cd", cd);
  const url = `${BASE}/addr/stage.json?${params}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  const json = (await res.json()) as StageResponse;
  if (json.errCd !== 0) throw new Error(`SGIS stage 오류 (${json.errCd}): ${json.errMsg}`);
  return json.result ?? [];
}

// ─────────────────────────────────────────────────────────────
// 인구 통계 조회 (searchpopulation)
// ─────────────────────────────────────────────────────────────

export interface PopulationRow {
  adm_cd: string;       // 행정구역 코드
  adm_nm: string;       // 행정구역 이름
  tot_ppltn: number;    // 총 인구
  tot_family: number;   // 총 가구
  avg_age: number;      // 평균 연령
  ppltn_dnsty: number;  // 인구 밀도 (명/㎢)
  // 연령대 분포 (검색 옵션에 따라 응답)
  ppltn_male?: number;
  ppltn_female?: number;
}

interface PopulationResponse {
  errCd: number;
  errMsg: string;
  result: PopulationRow[];
}

/**
 * 행정구역 단위 인구 조회.
 *  - year: 통계 연도 (예: "2023") — SGIS는 매년 11월 전후 직전년도 통계 갱신
 *  - admCd: 시도/시군구/행정동 코드 (생략 시 전국)
 *  - low_search: 하위 행정구역까지 펼침 (0=해당단위만, 1=하위포함)
 */
export async function getPopulation(opts: {
  year: string;
  admCd?: string;
  lowSearch?: "0" | "1";
}): Promise<PopulationRow[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    accessToken: token,
    year: opts.year,
    low_search: opts.lowSearch ?? "0",
  });
  if (opts.admCd) params.set("adm_cd", opts.admCd);

  const url = `${BASE}/stats/searchpopulation.json?${params}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  const json = (await res.json()) as PopulationResponse;
  if (json.errCd !== 0) throw new Error(`SGIS population 오류 (${json.errCd}): ${json.errMsg}`);

  // numeric coerce
  return (json.result ?? []).map((r) => ({
    ...r,
    tot_ppltn:   Number(r.tot_ppltn) || 0,
    tot_family:  Number(r.tot_family) || 0,
    avg_age:     Number(r.avg_age) || 0,
    ppltn_dnsty: Number(r.ppltn_dnsty) || 0,
    ppltn_male:   r.ppltn_male   != null ? Number(r.ppltn_male)   : undefined,
    ppltn_female: r.ppltn_female != null ? Number(r.ppltn_female) : undefined,
  }));
}

// ─────────────────────────────────────────────────────────────
// 인구 + 연령 (population.json) — 연령대별 분포
// ─────────────────────────────────────────────────────────────

export interface AgePopulationRow {
  adm_cd: string;
  adm_nm: string;
  ppltn_age_0_9: number;
  ppltn_age_10_19: number;
  ppltn_age_20_29: number;
  ppltn_age_30_39: number;
  ppltn_age_40_49: number;
  ppltn_age_50_59: number;
  ppltn_age_60_69: number;
  ppltn_age_70_over: number;
  ppltn_male: number;
  ppltn_female: number;
  tot_ppltn: number;
}

interface AgePopResponse {
  errCd: number;
  errMsg: string;
  result: Array<Record<string, string>>;
}

/**
 * 인구·가구 조회 — 연령대 + 성별 분포.
 * SGIS의 /stats/population.json 엔드포인트.
 */
export async function getAgePopulation(opts: {
  year: string;
  admCd?: string;
  lowSearch?: "0" | "1";
}): Promise<AgePopulationRow[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    accessToken: token,
    year: opts.year,
    low_search: opts.lowSearch ?? "0",
  });
  if (opts.admCd) params.set("adm_cd", opts.admCd);

  const url = `${BASE}/stats/population.json?${params}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  const json = (await res.json()) as AgePopResponse;
  if (json.errCd !== 0) throw new Error(`SGIS age population 오류 (${json.errCd}): ${json.errMsg}`);

  return (json.result ?? []).map((r) => ({
    adm_cd:             r.adm_cd,
    adm_nm:             r.adm_nm,
    tot_ppltn:          Number(r.tot_ppltn) || 0,
    ppltn_male:         Number(r.ppltn_male) || 0,
    ppltn_female:       Number(r.ppltn_female) || 0,
    ppltn_age_0_9:      Number(r["ppltn_age_0_9"] ?? r["ppltn_age_0"]) || 0,
    ppltn_age_10_19:    Number(r["ppltn_age_10_19"] ?? r["ppltn_age_10"]) || 0,
    ppltn_age_20_29:    Number(r["ppltn_age_20_29"] ?? r["ppltn_age_20"]) || 0,
    ppltn_age_30_39:    Number(r["ppltn_age_30_39"] ?? r["ppltn_age_30"]) || 0,
    ppltn_age_40_49:    Number(r["ppltn_age_40_49"] ?? r["ppltn_age_40"]) || 0,
    ppltn_age_50_59:    Number(r["ppltn_age_50_59"] ?? r["ppltn_age_50"]) || 0,
    ppltn_age_60_69:    Number(r["ppltn_age_60_69"] ?? r["ppltn_age_60"]) || 0,
    ppltn_age_70_over:  Number(r["ppltn_age_70_over"] ?? r["ppltn_age_70"]) || 0,
  }));
}

// ─────────────────────────────────────────────────────────────
// 행정동 경계 (GeoJSON) — 점포 좌표 기준 3km 반경 매칭에 사용
// ─────────────────────────────────────────────────────────────

interface HadmAreaResponse {
  errCd: number;
  errMsg: string;
  result: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: {
        adm_cd: string;
        adm_nm: string;
        x: string; // centroid 또는 UTM-K
        y: string;
      };
      geometry: unknown;
    }>;
  };
}

/**
 * 시군구 내 모든 행정동의 경계 (GeoJSON).
 * x/y는 행정동 중심 좌표 (WGS84 추정 — 시도/시군구 코드에 따라 다를 수 있어 호출 시 확인).
 */
export async function getHadmAreaGeoJSON(admCd: string): Promise<HadmAreaResponse["result"]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    accessToken: token,
    adm_cd: admCd,
    low_search: "1",
  });
  const url = `${BASE}/boundary/hadmarea.geojson?${params}`;
  const res = await fetch(url, { next: { revalidate: 86400 * 7 } }); // 7일 캐시
  const json = (await res.json()) as HadmAreaResponse;
  if (json.errCd !== 0) throw new Error(`SGIS hadmarea 오류 (${json.errCd}): ${json.errMsg}`);
  return json.result;
}

// ─────────────────────────────────────────────────────────────
// 거리 계산 (Haversine)
// ─────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const aVal = sin1 * sin1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2 * sin2;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return EARTH_RADIUS_M * c;
}
