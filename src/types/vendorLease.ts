export interface VendorLeaseRow {
  id: string;
  name: string;           // 업체명
  types: string[];        // 유형 (multi-select)
  score: string | null;   // 점수
  is_checked: boolean;    // 체크박스
  status: string | null;  // 상태
  link: string | null;    // 링크
  contact: string | null; // 연락처
  keyman: string | null;  // 키맨
  memo: string | null;    // 기타
  created_at: string;
  updated_at: string;
}

export const LEASE_SCORES = ["⭐️⭐️⭐️⭐️⭐️", "⭐️⭐️⭐️⭐️", "⭐️⭐️⭐️", "⭐️⭐️", "⭐️", "미정"] as const;

export const LEASE_STATUSES = [
  "미팅전", "미팅완료", "입점제안", "계약검토", "입점중", "입점완료", "보류", "탈락",
] as const;

export const LEASE_STATUS_META: Record<string, { label: string; cls: string; group: "todo" | "progress" | "done" | "none" }> = {
  "미팅전":   { label: "미팅전",   cls: "bg-slate-100  text-slate-500",   group: "todo"     },
  "미팅완료": { label: "미팅완료", cls: "bg-blue-50    text-blue-500",    group: "todo"     },
  "입점제안": { label: "입점제안", cls: "bg-violet-50  text-violet-600",  group: "progress" },
  "계약검토": { label: "계약검토", cls: "bg-amber-50   text-amber-600",   group: "progress" },
  "입점중":   { label: "입점중",   cls: "bg-sky-50     text-sky-700",     group: "progress" },
  "입점완료": { label: "입점완료", cls: "bg-emerald-50 text-emerald-700", group: "done"     },
  "보류":     { label: "보류",     cls: "bg-slate-50   text-slate-400",   group: "none"     },
  "탈락":     { label: "탈락",     cls: "bg-rose-50    text-rose-500",    group: "none"     },
};

export const LEASE_TYPE_OPTIONS = [
  "패션", "잡화", "스포츠", "뷰티", "라이프스타일", "키즈", "아웃도어",
  "홈리빙", "전자", "도서", "문화", "건강", "애완", "서비스", "기타",
] as const;
