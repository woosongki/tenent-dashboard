const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("ko-KR");

export const formatKRW     = (v: number) => KRW.format(v);
export const formatNumber  = (v: number) => NUM.format(v);
export const formatPercent = (v: number) => `${v.toFixed(2)}%`;
export const formatRoas    = (v: number) => `${v.toFixed(2)}x`;
