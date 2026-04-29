export interface BrandPerformanceRow {
  id: string;
  category: string;
  brand_code: string | null;
  brand_name: string;
  row_type: "total" | "subtotal" | "brand";
  revenue_current: number | null;
  revenue_prev: number | null;
  revenue_growth: number | null;
  gross_profit_current: number | null;
  gross_profit_prev: number | null;
  gross_profit_growth: number | null;
  period_current: string;
  period_prev: string;
}

export const CATEGORIES = ["취미/라이프", "가정문화", "테넌트일반", "모던 특정"] as const;
export type CategoryName = (typeof CATEGORIES)[number];
