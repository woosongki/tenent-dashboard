import { describe, it, expect } from "vitest";
import { mapCatToRetail, RETAIL_CATEGORIES } from "./retailCategories";

describe("mapCatToRetail", () => {
  it("영캐를 캐주얼보다 먼저 매핑한다(순서 규칙)", () => {
    expect(mapCatToRetail("영캐쥬얼(특정)2001")).toBe("영캐주얼");
    expect(mapCatToRetail("캐쥬얼(특정매입)")).toBe("캐주얼");
  });

  it("ERP 복종 라벨을 10개 카테고리로 매핑한다", () => {
    expect(mapCatToRetail("잡화(특정매입)")).toBe("잡화");
    expect(mapCatToRetail("남성의류(특정매입)")).toBe("남성의류");
    expect(mapCatToRetail("아동의류(특정매입)")).toBe("아동의류");
    expect(mapCatToRetail("여성의류(특정)NC")).toBe("여성의류");
    expect(mapCatToRetail("스포츠(특정)NC")).toBe("스포츠");
    expect(mapCatToRetail("하이퍼")).toBe("하이퍼");
    expect(mapCatToRetail("F&B")).toBe("F&B");
    expect(mapCatToRetail("라이프스타일")).toBe("라이프스타일");
  });

  it("F&B·라이프스타일 세분류 별칭도 매핑한다", () => {
    expect(mapCatToRetail("외식")).toBe("F&B");
    expect(mapCatToRetail("카페")).toBe("F&B");
    expect(mapCatToRetail("리빙")).toBe("라이프스타일");
    expect(mapCatToRetail("가구")).toBe("라이프스타일");
  });

  it("매핑 불가한 라벨은 null", () => {
    expect(mapCatToRetail("기타")).toBeNull();
    expect(mapCatToRetail("")).toBeNull();
    expect(mapCatToRetail("서비스")).toBeNull();
  });

  it("모든 결과는 RETAIL_CATEGORIES 안의 값이거나 null", () => {
    const samples = ["캐쥬얼", "영캐", "잡화", "남성", "아동", "여성", "스포츠", "하이퍼", "외식", "리빙", "무엇"];
    for (const s of samples) {
      const r = mapCatToRetail(s);
      expect(r === null || (RETAIL_CATEGORIES as readonly string[]).includes(r)).toBe(true);
    }
  });
});
