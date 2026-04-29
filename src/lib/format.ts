const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("ko-KR");

export const formatKRW     = (v: number) => KRW.format(v);
export const formatNumber  = (v: number) => NUM.format(v);
export const formatPercent = (v: number) => `${v.toFixed(2)}%`;
export const formatRoas    = (v: number) => `${v.toFixed(2)}x`;

/**
 * 큰 금액을 한국식 단위로 압축해 표시
 * 1,200,000,000 → 12억  /  234,500,000 → 2.3억  /  5,600,000 → 560만  /  작은 값 → 원래 KRW
 */
export function formatAmount(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "")}조`;
  if (abs >= 100_000_000)       return `${sign}${(abs / 100_000_000).toFixed(1).replace(/\.0$/, "")}억`;
  if (abs >= 10_000)            return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  return KRW.format(v);
}
