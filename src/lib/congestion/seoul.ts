/**
 * 서울 열린데이터광장 - 실시간 도시데이터 (인구 혼잡도) 통합.
 *
 * - 5분 갱신
 * - 121개 핫스팟 권역
 * - 권역명을 URL path로 호출 (URL encode 필수)
 *
 * 응답 핵심 필드 (SeoulRtd.citydata_ppltn):
 *   AREA_NM, AREA_CD, AREA_CONGEST_LVL ("여유"|"보통"|"약간 붐빔"|"붐빔"),
 *   AREA_CONGEST_MSG, AREA_PPLTN_MIN, AREA_PPLTN_MAX,
 *   MALE_PPLTN_RATE, FEMALE_PPLTN_RATE,
 *   PPLTN_RATE_0/10/20/30/40/50/60/70, RESNT_PPLTN_RATE, NON_RESNT_PPLTN_RATE,
 *   PPLTN_TIME (yyyy-MM-dd HH:mm),
 *   FCST_YN, FCST_PPLTN: [{ FCST_TIME, FCST_CONGEST_LVL, FCST_PPLTN_MIN, FCST_PPLTN_MAX }, ...]
 */

import hotspotsData from "@/data/seoul-hotspots.json";

const KEY = process.env.SEOUL_OPEN_API_KEY;
const BASE = "http://openapi.seoul.go.kr:8088";

// ─────────────────────────────────────────────────────────────
// 권역 데이터
// ─────────────────────────────────────────────────────────────

export interface Hotspot {
  name: string;
  code: string | null;
  gu: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
}

interface HotspotsFile {
  source: string;
  importedAt: string;
  count: number;
  records: Hotspot[];
}

const file = hotspotsData as HotspotsFile;

export function getHotspots(): Hotspot[] {
  return file.records;
}

// ─────────────────────────────────────────────────────────────
// 가장 가까운 권역 매칭
// ─────────────────────────────────────────────────────────────

const EARTH_R = 6371000;
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const av = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * EARTH_R * Math.atan2(Math.sqrt(av), Math.sqrt(1 - av));
}

/** 점포 좌표에서 가장 가까운 핫스팟 (좌표 보유한 권역만). 최대 거리(m) 옵션. */
export function findNearestHotspot(
  point: { lat: number; lng: number },
  maxDistanceM: number = 5000,
): { hotspot: Hotspot; distanceM: number } | null {
  const candidates = getHotspots().filter((h) => h.lat != null && h.lng != null);
  if (candidates.length === 0) return null;

  let best: { hotspot: Hotspot; distanceM: number } | null = null;
  for (const h of candidates) {
    const d = haversine(point, { lat: h.lat!, lng: h.lng! });
    if (!best || d < best.distanceM) {
      best = { hotspot: h, distanceM: d };
    }
  }
  if (!best || best.distanceM > maxDistanceM) return null;
  return best;
}

// ─────────────────────────────────────────────────────────────
// API 호출
// ─────────────────────────────────────────────────────────────

export type CongestLevel = "여유" | "보통" | "약간 붐빔" | "붐빔";

export interface CongestionForecast {
  fcstTime: string;       // "yyyy-MM-dd HH:mm"
  fcstCongestLvl: CongestLevel | string;
  fcstPpltnMin: number;
  fcstPpltnMax: number;
}

export interface CongestionRow {
  areaName: string;
  areaCode: string | null;
  congestLvl: CongestLevel | string;
  congestMsg: string;
  ppltnMin: number;
  ppltnMax: number;
  maleRate: number;
  femaleRate: number;
  ageRate: {
    "0_9": number; "10_19": number; "20_29": number; "30_39": number;
    "40_49": number; "50_59": number; "60_69": number; "70_over": number;
  };
  residentRate: number;
  nonResidentRate: number;
  ppltnTime: string;
  forecasts: CongestionForecast[];
}

interface RawCityData {
  "SeoulRtd.citydata_ppltn"?: Array<Record<string, string | number | unknown>> & {
    [key: string]: unknown;
  };
}

/**
 * 권역명으로 실시간 인구 데이터 조회 (5분 캐시).
 * 빌드 시 정적 호출은 토큰 노출 우려 + 실시간성 무의미 → server 호출 위주.
 */
export async function fetchCongestionByAreaName(
  areaName: string,
): Promise<CongestionRow | null> {
  if (!KEY) {
    if (typeof window === "undefined") {
      console.warn("[seoul] SEOUL_OPEN_API_KEY 미설정");
    }
    return null;
  }
  const encoded = encodeURIComponent(areaName);
  const url = `${BASE}/${KEY}/json/citydata_ppltn/1/1/${encoded}`;

  let res;
  try {
    res = await fetch(url, { next: { revalidate: 300 } }); // 5분 캐시
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let json: RawCityData;
  try { json = await res.json(); }
  catch { return null; }

  // 응답 구조: { "SeoulRtd.citydata_ppltn": [{...}], "RESULT": {...} }
  const arr = (json["SeoulRtd.citydata_ppltn"] ?? null) as Array<Record<string, unknown>> | null;
  const row = Array.isArray(arr) ? arr[0] : null;
  if (!row) return null;

  const num = (k: string) => Number(row[k]) || 0;
  const str = (k: string) => String(row[k] ?? "");

  // 예측 배열
  const fcstRaw = (row["FCST_PPLTN"] ?? []) as Array<Record<string, unknown>>;
  const forecasts: CongestionForecast[] = Array.isArray(fcstRaw)
    ? fcstRaw.map((f) => ({
        fcstTime: String(f["FCST_TIME"] ?? ""),
        fcstCongestLvl: String(f["FCST_CONGEST_LVL"] ?? ""),
        fcstPpltnMin: Number(f["FCST_PPLTN_MIN"]) || 0,
        fcstPpltnMax: Number(f["FCST_PPLTN_MAX"]) || 0,
      }))
    : [];

  return {
    areaName: str("AREA_NM"),
    areaCode: str("AREA_CD") || null,
    congestLvl: str("AREA_CONGEST_LVL"),
    congestMsg: str("AREA_CONGEST_MSG"),
    ppltnMin: num("AREA_PPLTN_MIN"),
    ppltnMax: num("AREA_PPLTN_MAX"),
    maleRate: num("MALE_PPLTN_RATE"),
    femaleRate: num("FEMALE_PPLTN_RATE"),
    ageRate: {
      "0_9":     num("PPLTN_RATE_0"),
      "10_19":   num("PPLTN_RATE_10"),
      "20_29":   num("PPLTN_RATE_20"),
      "30_39":   num("PPLTN_RATE_30"),
      "40_49":   num("PPLTN_RATE_40"),
      "50_59":   num("PPLTN_RATE_50"),
      "60_69":   num("PPLTN_RATE_60"),
      "70_over": num("PPLTN_RATE_70"),
    },
    residentRate:    num("RESNT_PPLTN_RATE"),
    nonResidentRate: num("NON_RESNT_PPLTN_RATE"),
    ppltnTime: str("PPLTN_TIME"),
    forecasts,
  };
}

/** 혼잡도 → 색상/UI 톤 */
export const CONGEST_BG: Record<string, string> = {
  "여유":       "bg-emerald-400 text-emerald-950",
  "보통":       "bg-cyan-400 text-cyan-950",
  "약간 붐빔":  "bg-yellow-300 text-[#0a0a0a]",
  "붐빔":       "bg-rose-500 text-white",
};
