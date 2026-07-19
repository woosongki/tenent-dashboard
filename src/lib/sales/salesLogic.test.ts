import { describe, it, expect } from "vitest";
import { dedupe } from "./ingest";
import { isOthersBrand } from "./labels";

describe("dedupe", () => {
  it("키가 같은 행의 sumCols를 합산해 1행으로 병합한다", () => {
    const rows = [
      { store: "A", cat: "여성", sales: 100, gp: 10 },
      { store: "A", cat: "여성", sales: 50, gp: 5 },
      { store: "B", cat: "여성", sales: 30, gp: 3 },
    ];
    const out = dedupe(rows, ["store", "cat"], ["sales", "gp"]);
    expect(out).toHaveLength(2);
    const a = out.find((r) => r.store === "A")!;
    expect(a.sales).toBe(150);
    expect(a.gp).toBe(15);
  });

  it("병합 시 원본을 변형하지 않는다(첫 행 복제)", () => {
    const rows = [
      { k: "x", v: 1 },
      { k: "x", v: 2 },
    ];
    const out = dedupe(rows, ["k"], ["v"]);
    expect(rows[0].v).toBe(1); // 원본 불변
    expect(out[0].v).toBe(3);
  });

  it("중복이 없으면 그대로 반환", () => {
    const rows = [{ k: "a", v: 1 }, { k: "b", v: 2 }];
    expect(dedupe(rows, ["k"], ["v"])).toHaveLength(2);
  });
});

describe("isOthersBrand", () => {
  it("정확 일치 '그외' 브랜드", () => {
    expect(isOthersBrand("엠페스트")).toBe(true);
    expect(isOthersBrand("코코몽키즈랜드")).toBe(true);
    expect(isOthersBrand(" 이키즈랜드 ")).toBe(true); // trim
  });

  it("문화센터/소극장( 접두 규칙", () => {
    expect(isOthersBrand("문화센터(CULTURECENTER")).toBe(true);
    expect(isOthersBrand("소극장(LITTLETHEATER")).toBe(true);
  });

  it("'소극장 마니마니'(별개 브랜드)는 제외", () => {
    expect(isOthersBrand("소극장 마니마니")).toBe(false);
  });

  it("일반 브랜드·빈값은 false", () => {
    expect(isOthersBrand("스파오")).toBe(false);
    expect(isOthersBrand(null)).toBe(false);
    expect(isOthersBrand(undefined)).toBe(false);
    expect(isOthersBrand("")).toBe(false);
  });
});
