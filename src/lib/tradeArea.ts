/**
 * 점포별 주변 상권 분석 데이터 로더.
 *
 * 데이터 출처: scripts/fetch-trade-area.mjs (소상공인진흥공단 상가업소 OpenAPI)
 * - 매장 좌표 반경 500m 기준 업종별 점포 분포
 * - 식음·소매·생활서비스·의료·교육·관광 6대 분류
 * - 경쟁점(백화점/아울렛/대형마트) 카운트
 * - 자동 상권 라벨링 ("음식 중심 상권", "학세권" 등)
 *
 * ⚠ node:fs 를 쓰므로 server-only. 클라이언트 컴포넌트는
 *   `@/lib/tradeAreaTypes` 에서 타입·TRADE_AREA_BADGE 만 import.
 */

import "server-only";
import fs from "node:fs";
import path from "node:path";

import type {
  TradeAreaIndexItem,
  TradeAreaBreakdown,
  TradeAreaDetail,
  CohortStat,
} from "./tradeAreaTypes";

// Re-export types and the badge token for backward compatibility.
export type { TradeAreaIndexItem, TradeAreaBreakdown, TradeAreaDetail, CohortStat };
export { TRADE_AREA_BADGE } from "./tradeAreaTypes";

const DATA_DIR = path.join(process.cwd(), "data/trade-area");

interface IndexFile {
  generatedAt: string;
  radius: number;
  count: number;
  stores: TradeAreaIndexItem[];
}

/** 인덱스 파일이 존재하는지 (스크립트가 한 번이라도 돌았는지) */
export function hasTradeAreaData(): boolean {
  return fs.existsSync(path.join(DATA_DIR, "_index.json"));
}

/** 전 매장 요약 인덱스 */
export function getTradeAreaIndex(): IndexFile | null {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, "_index.json"), "utf8");
    return JSON.parse(raw) as IndexFile;
  } catch {
    return null;
  }
}

/** 매장 ID → 상세 (rawStores 제외) */
export function getTradeArea(storeId: string): TradeAreaDetail | null {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, `${storeId}.json`), "utf8");
    const parsed = JSON.parse(raw) as TradeAreaDetail & { rawStores?: unknown };
    delete parsed.rawStores;
    return parsed;
  } catch {
    return null;
  }
}

/** 매장이 속한 상권 유형 cohort 통계 + 비교 매장 */
export function getCohortStat(storeId: string): CohortStat | null {
  const idx = getTradeAreaIndex();
  if (!idx) return null;
  const me = idx.stores.find((s) => s.id === storeId);
  if (!me) return null;

  const cohort = idx.stores.filter((s) => s.tradeAreaType === me.tradeAreaType);
  if (cohort.length === 0) return null;

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  const totals = cohort.map((s) => s.total).sort((a, b) => a - b);
  const myRank = totals.filter((t) => t < me.total).length;
  const totalPercentile = cohort.length > 1 ? Math.round((myRank / (cohort.length - 1)) * 100) : 50;

  // 비교 대상: 같은 cohort 내, 점포 수 기준 가까운 매장 우선 (자기 자신 제외)
  const peers = cohort
    .filter((s) => s.id !== storeId)
    .sort((a, b) => Math.abs(a.total - me.total) - Math.abs(b.total - me.total))
    .slice(0, 6)
    .map((s) => ({
      id: s.id,
      brand: s.brand,
      name: s.name,
      total: s.total,
      competitorCount: s.competitorCount,
    }));

  return {
    cohortSize: cohort.length,
    avgTotal: Math.round(avg(cohort.map((s) => s.total))),
    avgFoodPct: avg(cohort.map((s) => s.foodPct)),
    avgRetailPct: avg(cohort.map((s) => s.retailPct)),
    avgCompetitor: avg(cohort.map((s) => s.competitorCount)),
    totalPercentile,
    peers,
  };
}

