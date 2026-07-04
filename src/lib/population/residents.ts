// 행정동 거주인구 스냅샷 접근 (상권분석 [storeId] 페이지용).
//
// 데이터: 행정안전부 주민등록 인구현황(공공데이터포털 15097972).
// 생성: `node scripts/fetch-population.mjs` → src/data/population.json (월 1회 갱신).
// 매칭: 점포 시군구(region2)로 행정동 합산 + 점포 행정동(region3) 단일(법정동↔행정동
//       명이 달라 미매칭이면 dong=null → 시군구 수치를 주 지표로 사용).

import raw from "@/data/population.json";

export interface AgeGroups {
  "0_9": number; "10_19": number; "20_29": number; "30_39": number;
  "40_49": number; "50_59": number; "60_69": number; "70_over": number;
}
export interface ResidentAgg {
  total: number; male: number; female: number; ageGroups: AgeGroups;
}
export interface SigunguResidents extends ResidentAgg { name: string; dongCount: number; }
export interface DongResidents extends ResidentAgg { name: string; }
export interface ResidentRecord {
  storeId: string;
  brand: string;
  name: string;
  region: { "1": string; "2": string; "3": string | null };
  sigungu: SigunguResidents;
  dong: DongResidents | null;
}
interface PopulationFile { baseYm: string; source: string; records: ResidentRecord[]; }

const data = raw as unknown as PopulationFile;

/** 데이터 기준연월 (예: '2026-05-31'). */
export const RESIDENTS_BASE_YM: string = data.baseYm;

/** 점포 id로 거주인구 레코드 조회. 없으면 null. */
export function getResidents(storeId: string): ResidentRecord | null {
  return data.records.find((r) => r.storeId === storeId) ?? null;
}

/** 연령대 8구간 표시 라벨 (키 순서 고정). */
export const AGE_GROUP_LABELS: [keyof AgeGroups, string][] = [
  ["0_9", "0~9"], ["10_19", "10대"], ["20_29", "20대"], ["30_39", "30대"],
  ["40_49", "40대"], ["50_59", "50대"], ["60_69", "60대"], ["70_over", "70+"],
];

/** 합계 대비 비중(%) — 0 나눗셈 방지. */
export function pctOf(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}
