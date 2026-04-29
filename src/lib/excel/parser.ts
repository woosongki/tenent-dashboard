import * as XLSX from "xlsx";
import type { CellValue, ParsedSheet, ParseResult, ParseOptions } from "@/types/excel";

const ALLOWED_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",                                           // .xls
  "text/csv",                                                            // .csv
]);
const ALLOWED_EXT = /\.(xlsx|xls|csv)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export class ExcelParseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ExcelParseError";
  }
}

export function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new ExcelParseError(
      `파일 크기가 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과합니다.`,
      "FILE_TOO_LARGE",
    );
  }
  if (!ALLOWED_MIME.has(file.type) && !ALLOWED_EXT.test(file.name)) {
    throw new ExcelParseError(
      ".xlsx, .xls, .csv 파일만 업로드 가능합니다.",
      "INVALID_FILE_TYPE",
    );
  }
}

function cellToValue(cell: XLSX.CellObject | undefined, dateAsString: boolean): CellValue {
  if (!cell) return null;

  switch (cell.t) {
    case "n":
      // 날짜 서식 코드(14~22, 45~47) 감지
      if (
        dateAsString &&
        cell.z &&
        /[yYmMdDhHsS]/.test(String(cell.z)) &&
        typeof cell.v === "number"
      ) {
        const date = XLSX.SSF.parse_date_code(cell.v);
        if (date) {
          return new Date(
            Date.UTC(date.y, date.m - 1, date.d, date.H, date.M, date.S),
          ).toISOString();
        }
      }
      return typeof cell.v === "number" ? cell.v : null;
    case "s":
      return typeof cell.v === "string" ? cell.v.trim() : null;
    case "b":
      return typeof cell.v === "boolean" ? cell.v : null;
    case "d":
      return dateAsString && cell.v instanceof Date
        ? cell.v.toISOString()
        : (cell.v as CellValue);
    default:
      return null;
  }
}

function parseSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  opts: Required<ParseOptions>,
): ParsedSheet {
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");

  // 헤더 행 읽기
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: opts.headerRow, c: col });
    const cell = worksheet[addr] as XLSX.CellObject | undefined;
    const raw = cell ? String(cell.v ?? "").trim() : "";
    headers.push(raw || `column_${col + 1}`);
  }

  // 데이터 행 읽기
  const rows: Record<string, CellValue>[] = [];
  for (let row = opts.headerRow + 1; row <= range.e.r; row++) {
    const record: Record<string, CellValue> = {};
    let hasValue = false;

    for (let col = range.s.c; col <= range.e.c; col++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[addr] as XLSX.CellObject | undefined;
      const value = cellToValue(cell, opts.dateAsString);
      record[headers[col - range.s.c]] = value;
      if (value !== null && value !== "") hasValue = true;
    }

    if (opts.skipEmptyRows && !hasValue) continue;
    rows.push(record);
  }

  return { name: sheetName, headers, rows, totalRows: rows.length };
}

export async function parseExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  fileSize: number,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const opts: Required<ParseOptions> = {
    sheetNames: options.sheetNames ?? [],
    headerRow: options.headerRow ?? 0,
    skipEmptyRows: options.skipEmptyRows ?? true,
    dateAsString: options.dateAsString ?? true,
  };

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const targetSheets =
    opts.sheetNames.length > 0
      ? workbook.SheetNames.filter((n) => opts.sheetNames.includes(n))
      : workbook.SheetNames;

  if (targetSheets.length === 0) {
    throw new ExcelParseError("파싱할 시트를 찾을 수 없습니다.", "NO_SHEET_FOUND");
  }

  const sheets = targetSheets.map((name) =>
    parseSheet(workbook.Sheets[name], name, opts),
  );

  return {
    sheets,
    fileName,
    fileSize,
    parsedAt: new Date().toISOString(),
  };
}
