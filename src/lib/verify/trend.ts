import "server-only";
import type { SearchTrend } from "./types";

interface NaverDataLabResponse {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: Array<{
    title: string;
    keywords: string[];
    data: Array<{ period: string; ratio: number }>;
  }>;
}

/**
 * 네이버 데이터랩 검색 트렌드 (최근 12개월 월별)
 * 필요: NAVER_SEARCH_CLIENT_ID/SECRET (앱에 "데이터랩(검색어 트렌드)" scope 추가 필요)
 * 실패 시 null 반환 (선택적 기능, 파이프라인 중단하지 않음)
 */
export async function fetchSearchTrend(keyword: string): Promise<SearchTrend | null> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1);

  const body = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    timeUnit: "month",
    keywordGroups: [
      { groupName: keyword, keywords: [keyword] },
    ],
  };

  try {
    const res = await fetch("https://naverapihub.apigw.ntruss.com/datalab/v1/search", {
      method: "POST",
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // 401 = 앱에 데이터랩 scope 미추가, 400 = 요청 오류 등 — 모두 graceful skip
      return null;
    }

    const data = (await res.json()) as NaverDataLabResponse;
    const series = data.results[0]?.data ?? [];
    if (series.length === 0) return null;

    // 추이 분석: 최근 3개월 평균 vs 직전 3개월 평균 비교
    const last3 = series.slice(-3);
    const prev3 = series.slice(-6, -3);
    const last3Avg = last3.reduce((s, p) => s + p.ratio, 0) / Math.max(last3.length, 1);
    const prev3Avg = prev3.length > 0 ? prev3.reduce((s, p) => s + p.ratio, 0) / prev3.length : last3Avg;
    const momentumPct = prev3Avg > 0 ? ((last3Avg - prev3Avg) / prev3Avg) * 100 : 0;

    // 피크 월 식별
    const peak = series.reduce((max, p) => (p.ratio > max.ratio ? p : max), series[0]);

    let momentum: SearchTrend["momentum"] = "stable";
    if (momentumPct >= 20) momentum = "rising";
    else if (momentumPct <= -20) momentum = "declining";

    return {
      keyword,
      timeUnit: "month",
      monthly: series.map((p) => ({ month: p.period.slice(0, 7), ratio: Math.round(p.ratio * 10) / 10 })),
      peakMonth: peak.period.slice(0, 7),
      peakRatio: Math.round(peak.ratio * 10) / 10,
      recent3MonthAvg: Math.round(last3Avg * 10) / 10,
      prev3MonthAvg: Math.round(prev3Avg * 10) / 10,
      momentum,
      momentumPct: Math.round(momentumPct * 10) / 10,
    };
  } catch {
    return null;
  }
}
