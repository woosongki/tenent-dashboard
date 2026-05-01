export interface TopBrand {
  rank: number;
  brand_name: string;
  category: string;
  revenue_current: number | null;
  revenue_prev: number | null;
  revenue_growth: number;
}

export interface CategoryStat {
  category: string;
  count: number;
  revenue: number;
}

export interface ContentPoolBreakdown {
  /** 라이프스타일 — goals.pool_type='lifestyle' */
  lifestyle: number;
  /** F&B — vendor_fnb 테이블 (컨텐츠 풀 F&B 탭 실제 표시 데이터) */
  fnb: number;
  /** 팝업 — goals.pool_type='popup' */
  popup: number;
}

export interface DashboardSummary {
  totalOrgs: number;
  totalMembers: number;
  activeSubscriptions: number;
  pendingInvitations: number;
  mrr: number;
  mrrChange: number;
  topBrands: TopBrand[];
  /** 사이드바 "컨텐츠 풀" 페이지의 3개 탭(라이프스타일·F&B·팝업) 합계 */
  contentPoolCount: number;
  contentPoolBreakdown: ContentPoolBreakdown;
  /** 입점 완료율 계산용 — brand_performance 전체 행 수 */
  brandTotalCount: number;
  positiveGrowthCount: number;
  categoryStats: CategoryStat[];
}

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  planName: string;
  planDisplayName: string;
  memberCount: number;
  maxSeats: number;
  subscriptionStatus: string;
  billingInterval: string | null;
  currentPrice: number;
  createdAt: string;
}

export interface CategoryGroup {
  planName: string;
  planDisplayName: string;
  orgs: OrgRow[];
  totalMembers: number;
  totalRevenue: number;
}
