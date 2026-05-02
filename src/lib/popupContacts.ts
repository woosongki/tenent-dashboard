// 💫이랜드리테일 콘텐츠팝업팀 - 팝업 컨텍판 (Desktop CSV)
// scripts/import-popup-contacts.mjs 로 src/data/popup-contacts.json 생성.
// 외부 DB 의존 없이 빌드 타임 정적 데이터로 사용.

import data from "@/data/popup-contacts.json";

export type PopupStage =
  | "미확보"
  | "컨택포인트 확보"
  | "미팅 예정"
  | "조건 협의"
  | "확정";

export type PopupField =
  | "F&B"
  | "패션"
  | "리빙"
  | "뷰티"
  | "IP"
  | "체험/전시"
  | string;

export interface PopupContact {
  no: number;
  industry: string | null;
  company: string | null;
  brand: string;
  isFirstPage: boolean;
  manager: string | null;
  field: PopupField | null;
  grade: string | null; // A/B/N
  contactName: string | null;
  phone: string | null;
  email: string | null;
  stage: PopupStage | string | null;
  reference: string | null;
  hopeStore: string | null;
  hopeLoc: string | null;
  progressAt: string | null;
  newManager: string | null;
}

interface Payload {
  source: string;
  importedAt: string;
  count: number;
  records: PopupContact[];
}

const payload = data as Payload;

export function getPopupContacts(): PopupContact[] {
  return payload.records;
}

export function getPopupContactsMeta() {
  return { source: payload.source, importedAt: payload.importedAt, count: payload.count };
}

export function getPopupContactCount(): number {
  return payload.count;
}

export const STAGE_ORDER: PopupStage[] = [
  "미확보",
  "컨택포인트 확보",
  "미팅 예정",
  "조건 협의",
  "확정",
];

export function getPopupStageBreakdown(): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const s of STAGE_ORDER) acc[s] = 0;
  for (const r of payload.records) {
    if (!r.stage) continue;
    acc[r.stage] = (acc[r.stage] ?? 0) + 1;
  }
  return acc;
}

export function getPopupFieldBreakdown(): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of payload.records) {
    if (!r.field) continue;
    acc[r.field] = (acc[r.field] ?? 0) + 1;
  }
  return acc;
}

export const STAGE_BADGE: Record<string, string> = {
  "확정":            "bg-emerald-50 text-emerald-700 border-emerald-200",
  "조건 협의":        "bg-blue-50 text-blue-700 border-blue-200",
  "미팅 예정":        "bg-violet-50 text-violet-700 border-violet-200",
  "컨택포인트 확보":   "bg-slate-50 text-slate-700 border-slate-200",
  "미확보":           "bg-slate-50 text-slate-400 border-slate-200",
};

export const FIELD_BADGE: Record<string, string> = {
  "F&B":      "bg-orange-50 text-orange-700 border-orange-200",
  "패션":     "bg-pink-50 text-pink-700 border-pink-200",
  "리빙":     "bg-emerald-50 text-emerald-700 border-emerald-200",
  "뷰티":     "bg-rose-50 text-rose-700 border-rose-200",
  "IP":       "bg-violet-50 text-violet-700 border-violet-200",
  "체험/전시": "bg-teal-50 text-teal-700 border-teal-200",
};

export const GRADE_BADGE: Record<string, string> = {
  A: "bg-amber-50 text-amber-700 border-amber-200",
  B: "bg-slate-50 text-slate-700 border-slate-200",
  N: "bg-slate-50 text-slate-400 border-slate-200",
};
