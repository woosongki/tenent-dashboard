// 이식 검증: buildOfflineRows/buildOnlineRows 결과가 기존 스크립트(convert-*-xlsx.mjs)와
// 동일한 행수·매출합을 내는지, 실제 ERP 샘플 4개 파일로 대조.
//
// 샘플 파일은 민감 데이터라 리포에 커밋하지 않는다. SALES_FIXTURE_DIR 환경변수로
// 파일 폴더를 주면 검증하고, 없으면 skip (CI 안전). 로컬에서:
//   SALES_FIXTURE_DIR=/path/to/xlsx npx vitest run src/lib/sales/ingest.test.ts
// 파일명: 5.offline_cum.xlsx / 6.offline_month.xlsx / 8.online_cum.xlsx / 9.online_month.xlsx

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { buildOfflineRows, buildOnlineRows } from "./ingest";

const DIR = process.env.SALES_FIXTURE_DIR;
const have = !!DIR && existsSync(path.join(DIR, "5.offline_cum.xlsx"));

function buf(name: string): ArrayBuffer {
  const b = readFileSync(path.join(DIR!, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
const sum = <T extends { sales: number }>(rows: T[], where: (r: T) => boolean) =>
  rows.filter(where).reduce((t, r) => t + r.sales, 0);

describe.skipIf(!have)("sales ingest ↔ 기존 스크립트 정답 대조", () => {
  it("오프라인 누적: 14285행 · 2026 매출합 1,001,876,321,573", () => {
    const rows = buildOfflineRows(buf("5.offline_cum.xlsx"), "2026", "2025");
    expect(rows.length).toBe(14285);
    expect(sum(rows, (r) => r.period === "2026")).toBe(1_001_876_321_573);
  });

  it("오프라인 당월: 12133행 · 2026-06 매출합 99,692,783,089", () => {
    const rows = buildOfflineRows(buf("6.offline_month.xlsx"), "2026-06", "2025-06");
    expect(rows.length).toBe(12133);
    expect(sum(rows, (r) => r.period === "2026-06")).toBe(99_692_783_089);
  });

  it("온라인 당월: 4591행 · 2026-06 합 5,867,040,672", () => {
    const rows = buildOnlineRows(buf("9.online_month.xlsx"), "month");
    expect(rows.length).toBe(4591);
    expect(sum(rows, (r) => r.label === "2026-06")).toBe(5_867_040_672);
  });

  it("온라인 누적: 7176행 · 2026 합 57,488,319,424", () => {
    const rows = buildOnlineRows(buf("8.online_cum.xlsx"), "cum");
    expect(rows.length).toBe(7176);
    expect(sum(rows, (r) => r.label === "2026")).toBe(57_488_319_424);
  });
});
