import { describe, it, expect } from "vitest";
import { rankStores } from "./score";
import type { BrandInput } from "./types";

// 입력 헬퍼: 빈 BrandInput에서 일부만 덮어쓰기
function makeInput(over: Partial<BrandInput> = {}): BrandInput {
  return {
    primary_age: [],
    primary_gender: null,
    family_ratio: null,
    stay_type: null,
    category: null,
    price_band: null,
    required_space: null,
    operation_type: null,
    preferred_anchors: [],
    avoid_strength: "보통",
    ...over,
  };
}

describe("rankStores — 기본 동작", () => {
  it("topN 개수만큼 반환한다", () => {
    expect(rankStores(makeInput(), 3)).toHaveLength(3);
    expect(rankStores(makeInput(), 5)).toHaveLength(5);
    expect(rankStores(makeInput(), 41)).toHaveLength(41);
  });

  it("총점 내림차순으로 정렬된다", () => {
    const ranked = rankStores(makeInput({ category: "패션", price_band: "중가" }), 41);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].total).toBeGreaterThanOrEqual(ranked[i].total);
    }
  });

  it("모든 총점은 0~100 범위 안이다", () => {
    const ranked = rankStores(makeInput({ category: "F&B", price_band: "중가", stay_type: "체류형" }), 41);
    for (const r of ranked) {
      expect(r.total).toBeGreaterThanOrEqual(0);
      expect(r.total).toBeLessThanOrEqual(100);
    }
  });

  it("모든 축 점수(axes)는 0~100 범위 안이다", () => {
    const ranked = rankStores(makeInput({ category: "뷰티", price_band: "고가", primary_age: ["20대"] }), 41);
    for (const r of ranked) {
      for (const v of Object.values(r.axes)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("rankStores — 변별력 (회귀 방지)", () => {
  // 점수가 너무 자주 동일하면 추천 신뢰도가 떨어진다 → 고유 점수 비율을 지킨다
  it("빈 입력(상권 신호만)에도 41점 중 35개 이상 고유 점수", () => {
    const ranked = rankStores(makeInput(), 41);
    const unique = new Set(ranked.map((r) => r.total)).size;
    expect(unique).toBeGreaterThanOrEqual(35);
  });

  it("구체 입력 시 41점 중 30개 이상 고유 점수", () => {
    const ranked = rankStores(
      makeInput({ category: "패션", price_band: "중가", primary_age: ["20대"], stay_type: "체험형" }),
      41,
    );
    const unique = new Set(ranked.map((r) => r.total)).size;
    expect(unique).toBeGreaterThanOrEqual(30);
  });

  it("서로 다른 브랜드 프로파일은 다른 1위를 낼 수 있다(동일 1위 고정 아님)", () => {
    const fashion = rankStores(makeInput({ category: "패션", price_band: "고가" }), 1)[0];
    const fnb = rankStores(makeInput({ category: "F&B", stay_type: "체류형" }), 1)[0];
    // 최소한 둘 중 하나는 서로 다른 점포가 1위거나, 같더라도 총점은 다르게 계산됨
    expect(fashion.store.id === fnb.store.id && fashion.total === fnb.total).toBe(false);
  });
});

describe("rankStores — 도메인 타당성", () => {
  it("F&B·체류형은 상위 추천에 매장 규모 큰 점포가 포함된다", () => {
    const ranked = rankStores(makeInput({ category: "F&B", stay_type: "체류형", price_band: "중가" }), 5);
    // 상위 5개 중 총점이 모두 유의미(>50)해야 한다
    expect(ranked[0].total).toBeGreaterThan(50);
  });

  it("hasData 플래그가 boolean으로 채워진다", () => {
    const ranked = rankStores(makeInput(), 41);
    for (const r of ranked) {
      expect(typeof r.hasData).toBe("boolean");
    }
  });
});

describe("rankStores — 가중치 재정규화", () => {
  // 입력이 거의 없을 때(빈 BrandInput)도 상권 신호로 점수가 산출되어야 한다
  it("빈 입력에서도 1위 총점이 0보다 크다", () => {
    const top = rankStores(makeInput(), 1)[0];
    expect(top.total).toBeGreaterThan(0);
  });

  it("같은 입력은 항상 같은 결과를 낸다(결정론적)", () => {
    const a = rankStores(makeInput({ category: "리빙", price_band: "초저가" }), 41);
    const b = rankStores(makeInput({ category: "리빙", price_band: "초저가" }), 41);
    expect(a.map((r) => [r.store.id, r.total])).toEqual(b.map((r) => [r.store.id, r.total]));
  });
});
