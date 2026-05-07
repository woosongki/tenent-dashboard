// 공실해결 — 공실 4월 3주 CSV 정적 데이터.
// scripts/import-vacancy.mjs 가 src/data/vacancy.json 생성.
// 외부 DB 의존 없이 빌드 타임 정적 데이터로 사용.

import data from "@/data/vacancy.json";

export interface VacancyRow {
  headquarters: string | null;
  branch: string;
  floor: string | null;
  segments: string[];          // ["패션"] | ["비패션"] | ["외식"] (복수 가능)
  currentBrand: string | null; // 기존 브랜드
  altBrands: string[];         // 대안 브랜드 1안 + 2안
  areaPy: number | null;       // 면적(PY)
  category: string | null;     // 담당 카테고리 (예: 리징, 리빙, 여성, F&B …)
  stage: string | null;        // 진척사항 (1단계 ~ 4단계)
  note: string | null;         // 비고
  mdOpinion: string | null;    // MD 의견
}

interface Payload {
  source: string;
  importedAt: string;
  count: number;
  resolvedCount: number;
  records: VacancyRow[];
}

const payload = data as Payload;

/** 공실해결 KPI 기준 — 담당 카테고리·진척사항 */
export const VACANCY_KPI_CATEGORIES = ["리징", "리빙"] as const;
export const VACANCY_KPI_STAGES = ["3단계", "4단계"] as const;

const KPI_CATS = new Set<string>(VACANCY_KPI_CATEGORIES);
const KPI_STAGES = new Set<string>(VACANCY_KPI_STAGES);

export function getVacancyRows(): VacancyRow[] {
  return payload.records;
}

export function getVacancyMeta() {
  return {
    source: payload.source,
    importedAt: payload.importedAt,
    count: payload.count,
  };
}

/** 담당 카테고리 ∈ {리징, 리빙} AND 진척사항 ∈ {3단계, 4단계} */
export function isResolvedRow(r: VacancyRow): boolean {
  return Boolean(r.category && r.stage && KPI_CATS.has(r.category) && KPI_STAGES.has(r.stage));
}

export function getVacancyResolvedCount(): number {
  // 빌드 타임에 미리 계산된 값을 우선 사용. 없으면 런타임에 산출.
  if (typeof payload.resolvedCount === "number") return payload.resolvedCount;
  return payload.records.filter(isResolvedRow).length;
}

export const STAGE_BADGE: Record<string, string> = {
  "4단계": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "3단계": "bg-blue-50 text-blue-700 border-blue-200",
  "2단계": "bg-amber-50 text-amber-700 border-amber-200",
  "1단계": "bg-slate-50 text-slate-500 border-slate-200",
};

export const CATEGORY_BADGE: Record<string, string> = {
  "리징":   "bg-violet-50 text-violet-700 border-violet-200",
  "리빙":   "bg-emerald-50 text-emerald-700 border-emerald-200",
  "F&B":    "bg-orange-50 text-orange-700 border-orange-200",
  "여성":    "bg-pink-50 text-pink-700 border-pink-200",
  "신사":    "bg-slate-50 text-slate-700 border-slate-200",
  "아동":    "bg-sky-50 text-sky-700 border-sky-200",
  "스포츠":  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "캐주얼":  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "영캐주얼":"bg-rose-50 text-rose-700 border-rose-200",
  "잡화":    "bg-amber-50 text-amber-700 border-amber-200",
  "행사장":  "bg-teal-50 text-teal-700 border-teal-200",
  "기타":    "bg-slate-50 text-slate-500 border-slate-200",
};
