import { describe, it, expect } from "vitest";
import { detectWeakCategories } from "./retailCategories";

// 10개 카테고리 전부 채운 비중 객체 헬퍼(합 100 근처일 필요는 없음 — 판정은 카테고리별 독립).
function ratios(partial: Record<string, number>): Record<string, number> {
  const base: Record<string, number> = {
    캐주얼: 0, 잡화: 0, 영캐주얼: 0, 남성의류: 0, 아동의류: 0,
    여성의류: 0, 스포츠: 0, 하이퍼: 0, "F&B": 0, 라이프스타일: 0,
  };
  return { ...base, ...partial };
}

describe("detectWeakCategories", () => {
  it("cohort 평균의 70% 미만이면 약한 카테고리로 잡는다", () => {
    const me = ratios({ 스포츠: 5 });
    const peers = [ratios({ 스포츠: 20 }), ratios({ 스포츠: 20 })]; // 평균 20, 70%=14 > 5
    const weak = detectWeakCategories(me, peers);
    const sports = weak.find((w) => w.cat === "스포츠");
    expect(sports).toBeTruthy();
    expect(sports!.cohortAvg).toBe(20);
    expect(sports!.gap).toBe(15);
  });

  it("gap이 3%p 이상이면 70% 규칙을 넘겨도 약한 것으로 잡는다", () => {
    const me = ratios({ 잡화: 10 });
    const peers = [ratios({ 잡화: 14 }), ratios({ 잡화: 14 })]; // 평균 14, 70%=9.8<10 이지만 gap=4≥3
    const weak = detectWeakCategories(me, peers);
    expect(weak.some((w) => w.cat === "잡화")).toBe(true);
  });

  it("평균 이상이거나 근소 차이면 약하지 않다", () => {
    const me = ratios({ 여성의류: 20, 잡화: 13 });
    const peers = [ratios({ 여성의류: 18, 잡화: 14 }), ratios({ 여성의류: 18, 잡화: 14 })];
    // 여성의류: 내가 더 높음(gap<0) → 제외 / 잡화: 평균14, 70%=9.8<13 이고 gap=1<3 → 제외
    const weak = detectWeakCategories(me, peers);
    expect(weak.length).toBe(0);
  });

  it("gap 큰 순으로 정렬된다", () => {
    const me = ratios({ 스포츠: 0, 잡화: 5 });
    const peers = [ratios({ 스포츠: 30, 잡화: 15 }), ratios({ 스포츠: 30, 잡화: 15 })];
    const weak = detectWeakCategories(me, peers);
    expect(weak[0].cat).toBe("스포츠"); // gap 30 > 잡화 gap 10
    expect(weak.map((w) => w.gap)).toEqual([...weak.map((w) => w.gap)].sort((a, b) => b - a));
  });

  it("peer 데이터가 없는 카테고리는 건너뛴다", () => {
    const me = ratios({ 스포츠: 0 });
    const peers = [{} as Record<string, number>]; // 어떤 카테고리도 숫자 없음
    expect(detectWeakCategories(me, peers)).toEqual([]);
  });
});
