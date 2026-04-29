export type CellValue = string | number | boolean | Date | null;

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, CellValue>[];
  totalRows: number;
}

export interface ParseResult {
  sheets: ParsedSheet[];
  fileName: string;
  fileSize: number;
  parsedAt: string;
}

export interface UploadResult {
  uploadPath: string;
  publicUrl: string | null;
}

export interface ExcelUploadResponse {
  ok: true;
  parse: ParseResult;
  upload: UploadResult;
}

export interface ExcelUploadError {
  ok: false;
  error: string;
  detail?: string;
}

export type ExcelApiResponse = ExcelUploadResponse | ExcelUploadError;

export interface ParseOptions {
  /** 파싱할 시트 이름 목록. 미지정 시 전체 시트 */
  sheetNames?: string[];
  /** 헤더 행 번호 (0-based, 기본 0) */
  headerRow?: number;
  /** 빈 행 건너뜀 (기본 true) */
  skipEmptyRows?: boolean;
  /** 날짜 셀을 ISO 문자열로 변환 (기본 true) */
  dateAsString?: boolean;
}
