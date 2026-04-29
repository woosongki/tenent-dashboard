export interface VendorFnbRow {
  id: string;
  name: string;           // 업체명
  types: string[];        // 유형 (multi-select)
  score: string | null;   // 점수
  is_checked: boolean;    // 체크박스
  status: string | null;  // 팝업중
  link: string | null;    // 링크
  contact: string | null; // 연락처
  keyman: string | null;  // 키맨
  memo: string | null;    // 기타
  created_at: string;
  updated_at: string;
}

export const VENDOR_SCORES = ["⭐️⭐️⭐️⭐️⭐️", "⭐️⭐️⭐️⭐️", "⭐️⭐️⭐️", "⭐️⭐️", "⭐️", "미정"] as const;

export const VENDOR_STATUSES = [
  "미팅전", "미팅완료", "입점제안", "입점중", "팝업중", "입점완료", "확산제안", "확산완료",
] as const;

export const STATUS_META: Record<string, { label: string; cls: string; group: "todo" | "progress" | "done" }> = {
  "미팅전":   { label: "미팅전",   cls: "bg-slate-100  text-slate-500",   group: "todo"     },
  "미팅완료": { label: "미팅완료", cls: "bg-red-50     text-red-600",     group: "todo"     },
  "입점제안": { label: "입점제안", cls: "bg-blue-50    text-blue-600",    group: "progress" },
  "입점중":   { label: "입점중",   cls: "bg-blue-100   text-blue-700",    group: "progress" },
  "팝업중":   { label: "팝업중",   cls: "bg-violet-50  text-violet-700",  group: "progress" },
  "입점완료": { label: "입점완료", cls: "bg-emerald-50 text-emerald-700", group: "done"     },
  "확산제안": { label: "확산제안", cls: "bg-emerald-50 text-emerald-600", group: "done"     },
  "확산완료": { label: "확산완료", cls: "bg-emerald-100 text-emerald-800",group: "done"     },
};

// 대표 유형만 (UI 필터용) — 전체 목록은 Notion과 동기화
export const VENDOR_TYPE_OPTIONS = [
  "마라탕", "돈까스", "양식", "중식", "팝업", "델리", "간편식",
  "일식", "한식", "분식", "뷔페", "초밥", "파스타", "라멘",
  "베트남", "쌀국수", "버거", "커피", "디저트", "기타",
] as const;
