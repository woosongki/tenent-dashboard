// 세션 원문 파일 임포트 — 브라우저에서 파일 → 텍스트 추출.
// 지원: TXT·MD·CSV·TSV·XLSX·XLS·JSON (설치된 xlsx 재사용, 필요할 때만 dynamic import).
// 미지원(안내+우회): PPT·PDF·DOCX·HWP·녹음(음성) — 아래 UnsupportedImport로 사유/방법 반환.

export interface ImportResult { text: string; note: string; }

/** 사용자에게 "왜 안 되고 어떻게 하라"는 안내를 담은 에러. */
export class UnsupportedImport extends Error {}

const TEXT_EXT = ["txt", "text", "md", "markdown", "log", "json", "vtt", "srt"];
const SHEET_EXT = ["xlsx", "xls", "xlsm", "csv", "tsv"];
const AUDIO_EXT = ["mp3", "m4a", "wav", "aac", "ogg", "flac", "webm", "amr", "opus", "wma"];

/** 임포트 UI의 accept 속성 — 지원 + 흔한 미지원(안내용)까지 포함해 선택은 되게. */
export const IMPORT_ACCEPT =
  ".txt,.md,.csv,.tsv,.xlsx,.xls,.json,.vtt,.srt,.pptx,.ppt,.pdf,.docx,.hwp,.mp3,.m4a,.wav";

export async function extractTextFromFile(file: File): Promise<ImportResult> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = file.type || "";

  // ── 미지원: 녹음(음성) ──
  if (AUDIO_EXT.includes(ext) || mime.startsWith("audio/")) {
    throw new UnsupportedImport(
      "녹음 파일은 자동 전사가 안 됩니다(음성 인식은 별도 유료·외부 서비스 필요). " +
      "무료 우회: 네이버 클로바노트 · 윈도우 받아쓰기(Win+H) · 구글 문서 ‘음성 입력’으로 텍스트를 뽑아 붙여넣어 주세요.",
    );
  }
  // ── 미지원: 프레젠테이션 ──
  if (["pptx", "ppt", "key"].includes(ext)) {
    throw new UnsupportedImport(
      "PPT는 아직 자동 추출을 지원하지 않습니다. " +
      "우회: PowerPoint에서 [보기 › 개요]로 전환해 텍스트를 복사하거나, [파일 › 내보내기]로 서식 있는 텍스트(.rtf)/개요를 저장해 붙여넣어 주세요.",
    );
  }
  // ── 미지원: PDF ──
  if (ext === "pdf") {
    throw new UnsupportedImport(
      "PDF는 아직 자동 추출을 지원하지 않습니다. " +
      "우회: PDF 뷰어에서 텍스트를 복사해 붙여넣거나, .txt로 저장해 올려 주세요.",
    );
  }
  // ── 미지원: 워드/한글 ──
  if (["docx", "doc", "hwp", "hwpx", "pages", "rtf", "odt"].includes(ext)) {
    throw new UnsupportedImport(
      "이 문서 형식은 아직 자동 추출을 지원하지 않습니다. " +
      "우회: 원본에서 내용을 복사해 붙여넣거나, .txt로 저장해 올려 주세요.",
    );
  }

  // ── 지원: 스프레드시트/CSV (xlsx는 필요할 때만 로드) ──
  if (SHEET_EXT.includes(ext) || /spreadsheet|excel|csv/i.test(mime)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const chunks: string[] = [];
    for (const name of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
      if (csv.trim()) chunks.push(wb.SheetNames.length > 1 ? `# ${name}\n${csv}` : csv);
    }
    return { text: chunks.join("\n\n"), note: `${file.name} · 시트 ${wb.SheetNames.length}개` };
  }

  // ── 지원: 일반 텍스트 ──
  if (TEXT_EXT.includes(ext) || mime.startsWith("text/") || mime === "application/json" || ext === "") {
    return { text: await file.text(), note: file.name };
  }

  throw new UnsupportedImport(
    `지원하지 않는 형식(.${ext})입니다. TXT·CSV·XLSX로 저장하거나 내용을 복사해 붙여넣어 주세요.`,
  );
}
