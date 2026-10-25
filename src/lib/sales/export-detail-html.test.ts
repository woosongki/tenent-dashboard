import { describe, it, expect } from "vitest";
import { renderSalesDetailHtml, salesDetailExportFilename, type SalesDetailExportInput } from "./export-detail-html";
import { buildScopeSummary, buildStoreData } from "./detail";
import type { OffRank, OffSub } from "./queries";

// 단독 HTML 스냅샷 불변식: 자급자족 · 주입 차단 · 서버 확정 수치.
const sub = (key: string, s: number, ps: number, over: Partial<OffSub> = {}): OffSub => ({
  key, s, ps, g: s * 0.3, pg: ps * 0.3,
  growthS: s - ps, growthPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0,
  growthG: (s - ps) * 0.3, growthGPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0,
  area: 20, prevArea: 20, dppSales: Math.round(s / (20 * 30)), prevDppSales: Math.round(ps / (20 * 30)),
  dppSalesGrowthPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0, storeCnt: 1, ...over,
});
const brand = (key: string, division: string, cat: string, subs: OffSub[]): OffRank => {
  const s = subs.reduce((t, x) => t + x.s, 0), ps = subs.reduce((t, x) => t + x.ps, 0);
  return {
    key, division, cat, s, ps, g: s * 0.3, pg: ps * 0.3, gpm: 30,
    yoyPct: ps ? +((s - ps) / ps * 100).toFixed(1) : 0, subCount: subs.length,
    dppSales: Math.round(s / (20 * subs.length * 30)), prevDppSales: Math.round(ps / (20 * subs.length * 30)),
    dppSalesGrowthPct: 0, bySub: subs,
  };
};

const brands = [
  brand("브랜드가", "패션", "여성", [sub("강남점", 300e6, 250e6), sub("부산점", 180e6, 200e6)]),
  brand("브랜드나", "패션", "여성", [sub("강남점", 120e6, 0)]),
  brand('<script>alert(1)</script>', "기타", "리빙", [sub("강남점", 90e6, 80e6)]),
];
const input: SalesDetailExportInput = {
  periodLabel: "2026-09", prevLabel: "2025-09",
  brands,
  stores: [brand("강남점", "패션", "여성", [sub("브랜드가", 300e6, 250e6)])],
  divisions: [
    { division: "패션", s: 600e6, ps: 450e6, g: 180e6, gpm: 30, yoyPct: 33.3 },
    { division: "기타", s: 90e6, ps: 80e6, g: 27e6, gpm: 30, yoyPct: 12.5 },
  ],
  fashionCats: [{ cat: "여성", s: 600e6, ps: 450e6, g: 180e6, gpm: 30, yoyPct: 33.3 }],
  others: null,
  monthCount: 1,
  generatedAt: "2026-10-25T02:00:00.000Z",
};

describe("renderSalesDetailHtml", () => {
  const html = renderSalesDetailHtml(input);

  it("외부 리소스를 로드하지 않는다(오프라인 동작)", () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("브랜드명이 날 HTML로 새지 않는다", () => {
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("\\u003cscript\\u003ealert(1)");
  });

  it("스코프(칩)별 요약·행을 서버에서 확정해 담는다", () => {
    expect(html).toContain('"periodLabel":"2026-09"');
    expect(html).toContain('"label":"여성"');
    expect(html).toContain('"brandRows"');
    expect(html).toContain('"storeRows"');
  });

  it("담긴 요약은 공용 계산(buildScopeSummary)과 같다", () => {
    const fashion = brands.filter((b) => b.division === "패션" && b.cat === "여성");
    const expected = buildScopeSummary(fashion);
    expect(html).toContain(`"s":${expected.s}`);
    expect(html).toContain(`"yoyPct":${expected.yoyPct}`);
  });

  it("지점 피벗도 공용 계산(buildStoreData)과 같은 지점 수를 담는다", () => {
    const pivot = buildStoreData({ type: "cat", key: "여성" }, input.stores, brands, null);
    expect(pivot.map((r) => r.key).sort()).toEqual(["강남점", "부산점"]);
    for (const st of pivot) expect(html).toContain(`"key":"${st.key}"`);
  });

  it("파일명에 기간과 생성일이 들어간다", () => {
    expect(salesDetailExportFilename("2026-09", input.generatedAt)).toBe("sales-month-detail-2026-09-2026-10-25.html");
  });
});
