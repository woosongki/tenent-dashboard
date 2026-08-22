import { describe, it, expect } from "vitest";
import { scoreBrand, validateRuleset, diffGrades, type Ruleset, type BrandInput, type ScoreResult } from "./score";

// 포팅한 BCD 채점 핵심 불변식 보호 (PRD 08·10절).
const RULESET: Ruleset = {
  base: [
    { code: "C1", name: "절대A", weight: 40, mid: 20, mode: "abs", t1: 40, t2: 20 },
    { code: "C3", name: "분포",  weight: 30, mid: 15, mode: "pct", t1: 70, t2: 30 },
    { code: "C8", name: "선택",  weight: 30, mid: 15, mode: "sel", t1: 0,  t2: 0 },
  ],
  bonus: { code: "C7", name: "가점", weight: 5, mid: 3, mode: "abs", t1: 3, t2: 1 },
  cuts: { A: 85, Bp: 70, B: 55, C: 40 },
  na_policy: { max_na_points: 25, over_status: "미평가" },
  pct_min_sample: 3,
};

const brand = (id: string, values: BrandInput["values"], extra: Partial<BrandInput> = {}): BrandInput => ({
  id, category_major: "리빙", category_minor: "침구", online_applicable: true, values, ...extra,
});

describe("validateRuleset", () => {
  it("기본 배점 합이 100이면 통과, 아니면 저장 차단", () => {
    expect(validateRuleset(RULESET).ok).toBe(true);
    const bad = { ...RULESET, base: RULESET.base.slice(0, 2) };
    expect(validateRuleset(bad).ok).toBe(false);
  });
});

describe("scoreBrand", () => {
  const pool = [
    brand("a", { C1: 50, C3: 100, C8: 10, C7: 4 }),
    brand("b", { C1: 25, C3: 50, C8: 5, C7: 2 }),
    brand("c", { C1: 5, C3: 10, C8: 0, C7: 0 }),
  ];

  it("knockout 플래그는 점수 무관 H 등급", () => {
    const r = scoreBrand(brand("k", { C1: 50 }, { flag: { type: "knockout" } }), pool, RULESET);
    expect(r.grade).toBe("H");
  });

  it("N/A 배점이 정책 한도(25)를 넘으면 미평가", () => {
    // C1(40) 결측 → naPoints 40 > 25
    const r = scoreBrand(brand("n", { C1: null, C3: 100, C8: 10 }), pool, RULESET);
    expect(r.naCodes).toContain("C1");
    expect(r.grade).toBe("미평가");
  });

  it("online_applicable=false면 C7 값이 있어도 가점 0·감점 없음", () => {
    const r = scoreBrand(brand("x", { C1: 50, C3: 100, C8: 10, C7: 4 }, { online_applicable: false }), pool, RULESET);
    expect(r.bonusScore).toBe(0);
    expect(r.naCodes).not.toContain("C7");
  });

  it("만점 브랜드는 A 등급(base 100 + 가점)", () => {
    // C8은 sel 모드라 원값이 곧 점수(만점 30) — 만점 조건은 C8=30.
    const full = brand("full", { C1: 50, C3: 100, C8: 30, C7: 4 });
    const r = scoreBrand(full, [full, pool[1], pool[2]], RULESET);
    expect(r.baseScore).toBe(100);
    expect(r.grade).toBe("A");
  });
});

describe("diffGrades", () => {
  it("등급이 바뀐 브랜드만 추출", () => {
    const before: ScoreResult[] = [
      { brandId: "a", baseScore: 0, bonusScore: 0, total: 90, grade: "A", naCodes: [], naPoints: 0, breakdown: {}, searchPosition: null },
      { brandId: "b", baseScore: 0, bonusScore: 0, total: 60, grade: "B", naCodes: [], naPoints: 0, breakdown: {}, searchPosition: null },
    ];
    const after: ScoreResult[] = [
      { brandId: "a", baseScore: 0, bonusScore: 0, total: 90, grade: "A", naCodes: [], naPoints: 0, breakdown: {}, searchPosition: null },
      { brandId: "b", baseScore: 0, bonusScore: 0, total: 72, grade: "B+", naCodes: [], naPoints: 0, breakdown: {}, searchPosition: null },
    ];
    const changed = diffGrades(before, after);
    expect(changed).toEqual([{ brandId: "b", before: "B", after: "B+" }]);
  });
});
