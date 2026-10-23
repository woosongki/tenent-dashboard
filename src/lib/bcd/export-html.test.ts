import { describe, it, expect } from "vitest";
import { renderBcdHtml, bcdExportFilename, type BcdExportInput } from "./export-html";
import type { Ruleset, ScoreResult } from "./score";

// 단독 HTML 스냅샷의 불변식: 자급자족(외부 로드 없음) · 주입 차단 · 점수 재계산 없음.
const RULESET: Ruleset = {
  base: [
    { code: "C1", name: "벤치마크 유통 입점률", weight: 25, mid: 20, mode: "band", t1: 40, t2: 20 },
    { code: "C3", name: "전국 매장 수", weight: 75, mid: 38, mode: "pct", t1: 70, t2: 30 },
  ],
  bonus: { code: "C7", name: "온라인 채널", weight: 5, mid: 3, mode: "abs", t1: 3, t2: 1 },
  cuts: { A: 85, Bp: 70, B: 55, C: 40 },
  na_policy: { max_na_points: 25, over_status: "미평가" },
  pct_min_sample: 5,
};

const score: ScoreResult = {
  brandId: "b1", baseScore: 88, bonusScore: 3, total: 91, grade: "A",
  naCodes: [], naPoints: 0, searchPosition: "성장",
  breakdown: {
    C1: { value: 40, score: 25 },
    C3: { value: 120, score: 63, rank: 82, comparisonGroup: "category_minor:가구", comparisonSize: 7 },
  },
};

const input: BcdExportInput = {
  ruleset: RULESET,
  brands: [
    { id: "b1", name: "테스트브랜드", category_major: "홈·리빙", category_minor: "가구", scope_status: "active" },
    { id: "b2", name: '<img src=x onerror="alert(1)">', category_major: "홈·리빙", category_minor: "가구", scope_status: "excluded" },
  ],
  scores: [score],
  generatedAt: "2026-10-23T01:00:00.000Z",
};

describe("renderBcdHtml", () => {
  const html = renderBcdHtml(input);

  it("외부 리소스를 로드하지 않는다(오프라인에서 동일하게 열려야 함)", () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("브랜드명은 JSON으로만 심기고 날 HTML 태그로 새지 않는다", () => {
    expect(html).toContain("테스트브랜드");
    expect(html).not.toContain('<img src=x');
    expect(html).toContain("\\u003cimg src=x");
  });

  it("서버 채점 결과를 그대로 담는다(파일 안에서 재계산하지 않음)", () => {
    expect(html).toContain('"total":91');
    expect(html).toContain('"grade":"A"');
    expect(html).toContain('"maxNaPoints":25');
  });

  it("ruleset이 없어도 렌더된다", () => {
    const h = renderBcdHtml({ ...input, ruleset: null, scores: [] });
    expect(h).toContain('"hasRuleset":false');
  });

  it("파일명에 스냅샷 날짜가 들어간다", () => {
    expect(bcdExportFilename(input.generatedAt)).toBe("brand-concept-2026-10-23.html");
  });
});
