import { requireApproved } from "@/lib/auth/guards";
import { getExpiringContracts } from "@/lib/tenantContracts";

export const runtime = "nodejs";

// 알림 벨용 — 30일 이내 만료 임박 계약 요약(카운트 + 상위 6건).
export async function GET() {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  const items = await getExpiringContracts({ withinDays: 30 });
  const top = items.slice(0, 6).map((c) => ({
    storeName: c.storeName,
    brand: c.brand,
    purchaseName: c.purchaseName,
    contractEndDate: c.contractEndDate,
    daysUntilExpiry: c.daysUntilExpiry,
  }));
  const d14 = items.filter((c) => c.daysUntilExpiry <= 14).length;

  return Response.json({ d14, d30: items.length, items: top });
}
