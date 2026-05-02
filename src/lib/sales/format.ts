/**
 * 매출 표시용 순수 유틸 + 토큰.
 *
 * ⚠ 이 파일은 brand-sales.json 을 import 하지 않습니다.
 * Client Component(BrandComparisonTable, MonthlyComparisonChart 등)는
 * csvData.ts 대신 여기서 import 해야 240KB+ JSON 이 클라이언트 번들에 안 실립니다.
 */

/** Slate 디자인 시스템에 맞춘 그룹 색상 (도넛/카드 공용) */
export const GROUP_COLOR: Record<string, { hex: string; bg: string; text: string }> = {
  "FAA": { hex: "#8b5cf6", bg: "bg-violet-50",  text: "text-violet-700"  }, // 모던 특정
  "EBA": { hex: "#f59e0b", bg: "bg-amber-50",   text: "text-amber-700"   }, // 취미/라이프
  "EFA": { hex: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" }, // 가정문화
  "EGA": { hex: "#0ea5e9", bg: "bg-sky-50",     text: "text-sky-700"     }, // 테넌트일반
};

/** 잘림 보정: "(MODERN HOUSE" 같은 미완 → 짧은 라벨 */
export function shortBrandName(name: string, maxLen = 16): string {
  // 괄호 영문 제거 (UX용)
  const cleaned = name.replace(/\([^)]*\)?$/g, "").trim();
  if (cleaned.length === 0) return name;
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + "…";
}

const KRW_FORMAT = new Intl.NumberFormat("ko-KR");

/** "₩30,674,265,569" → "306억" / "30억 6천만" 등 컴팩트 표현 */
export function formatKRWCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1_0000_0000) {
    // 1억 이상
    const eok = Math.floor(abs / 1_0000_0000);
    const cheonman = Math.floor((abs % 1_0000_0000) / 10_000_000);
    const sign = amount < 0 ? "-" : "";
    return cheonman > 0 ? `${sign}${eok}억 ${cheonman}천만` : `${sign}${eok}억`;
  }
  if (abs >= 10_000) {
    return `${KRW_FORMAT.format(Math.round(amount / 10_000))}만`;
  }
  return KRW_FORMAT.format(amount);
}

export function formatKRW(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `₩${KRW_FORMAT.format(amount)}`;
}
