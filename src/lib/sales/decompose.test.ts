import { describe, it, expect } from "vitest";
import { decomposeSymmetric } from "./decompose";

describe("decomposeSymmetric", () => {
  it("두 효과의 합은 정확히 매출 증감(ΔS)과 같다", () => {
    const cases: [number, number, number, number][] = [
      [130, 100, 94, 90],   // 면적↑ 효율↑
      [130, 100, 90, 94],   // 면적↓(감축) 효율↑ — 좌판효율만의 성장
      [80, 100, 100, 90],   // 매출↓ 면적↑
      [500, 300, 250, 200], // 큰 값
    ];
    for (const [s1, s0, a1, a0] of cases) {
      const { areaEffect, effEffect } = decomposeSymmetric(s1, s0, a1, a0);
      expect(areaEffect + effEffect).toBeCloseTo(s1 - s0, 6);
    }
  });

  it("면적이 동일하면 증감은 전액 효율효과", () => {
    const { areaEffect, effEffect } = decomposeSymmetric(120, 100, 90, 90);
    expect(areaEffect).toBeCloseTo(0, 6);
    expect(effEffect).toBeCloseTo(20, 6);
  });

  it("평당매출(효율)이 동일하면 증감은 전액 면적효과", () => {
    // E 동일: s/a 가 같도록 — s1/a1 = 200/100 = 2, s0/a0 = 180/90 = 2
    const { areaEffect, effEffect } = decomposeSymmetric(200, 180, 100, 90);
    expect(effEffect).toBeCloseTo(0, 6);
    expect(areaEffect).toBeCloseTo(20, 6);
  });

  it("전년 실적/면적이 없으면(신규) 분해 불가 → {0,0}", () => {
    expect(decomposeSymmetric(100, 0, 50, 0)).toEqual({ areaEffect: 0, effEffect: 0 });
    expect(decomposeSymmetric(100, 50, 50, 0)).toEqual({ areaEffect: 0, effEffect: 0 });
  });
});
