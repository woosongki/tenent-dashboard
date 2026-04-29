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

export interface DashboardSummary {
  totalOrgs: number;
  totalMembers: number;
  activeSubscriptions: number;
  pendingInvitations: number;
  mrr: number;
  mrrChange: number;
  topBrands: TopBrand[];
  contentCount: number;
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
