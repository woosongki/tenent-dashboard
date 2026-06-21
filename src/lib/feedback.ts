// 팀 의견·개선 제안 — 공용 타입/상수

export type FeedbackStatus = "new" | "seen" | "done";

export interface Feedback {
  id: string;
  authorEmail: string | null;
  category: string | null;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
}

export const FEEDBACK_CATEGORIES = ["개선제안", "버그", "칭찬", "기타"] as const;

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "신규",
  seen: "확인",
  done: "완료",
};
