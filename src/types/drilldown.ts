export type ChannelType =
  | "organic_search" | "paid_search"
  | "paid_social"    | "organic_social"
  | "direct"         | "referral"
  | "email"          | "other";

export interface Channel {
  id: string;
  organizationId: string;
  name: string;
  type: ChannelType;
  color: string;
  isActive: boolean;
  createdAt: string;
}

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

/** channel_summary View 행 */
export interface ChannelSummary {
  channelId: string;
  channelName: string;
  channelType: ChannelType;
  color: string;
  totalSessions: number;
  totalConversions: number;
  totalRevenue: number;
  totalAdSpend: number;
  conversionRate: number;
  roas: number | null;
  cpa: number | null;
  /** 최근 N일 일별 sessions (Sparkline용) */
  sparkline: number[];
}

/** brand_channel_summary View 행 */
export interface BrandChannelSummary {
  brandId: string;
  brandName: string;
  brandColor: string;
  totalSessions: number;
  totalConversions: number;
  totalRevenue: number;
  totalAdSpend: number;
  conversionRate: number;
  roas: number | null;
  cpa: number | null;
}

/** 채널 내 브랜드별 일별 행 (누적 바 차트용) */
export interface BrandDailyStat {
  statDate: string;
  brandId: string;
  brandName: string;
  brandColor: string;
  sessions: number;
  revenue: number;
  adSpend: number;
}

/** 브랜드 상세 일별 행 */
export interface DailyStat {
  statDate: string;
  sessions: number;
  conversions: number;
  revenue: number;
  adSpend: number;
  conversionRate: number;
  roas: number | null;
  cpa: number | null;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

// ── 표시 메타 ────────────────────────────────────────────────

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  organic_search:  "검색 (오가닉)",
  paid_search:     "검색 광고",
  paid_social:     "SNS 광고",
  organic_social:  "SNS (오가닉)",
  direct:          "다이렉트",
  referral:        "레퍼럴",
  email:           "이메일",
  other:           "기타",
};

export const CHANNEL_TYPE_COLORS: Record<ChannelType, string> = {
  organic_search:  "#10b981",
  paid_search:     "#3b82f6",
  paid_social:     "#8b5cf6",
  organic_social:  "#a78bfa",
  direct:          "#6366f1",
  referral:        "#f59e0b",
  email:           "#ec4899",
  other:           "#9ca3af",
};
