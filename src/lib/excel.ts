import * as XLSX from "xlsx";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  /** 셀 값을 표시용으로 변환. 미지정 시 원본 그대로. */
  format?: (v: unknown) => string | number;
}

export function downloadExcel(
  filename: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[],
): void {
  // 헤더 행
  const header = columns.map((c) => c.header);

  // 데이터 행
  const data = rows.map((row) =>
    columns.map((c) => {
      const v = row[c.key];
      return c.format ? c.format(v) : (v ?? "");
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

  // 열 너비 설정
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${today}.xlsx`);
}
