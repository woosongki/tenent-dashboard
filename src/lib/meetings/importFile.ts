// 세션 원문 파일 임포트 — 파일 → 텍스트 추출.
// 클라 파싱: TXT·MD·CSV·TSV·XLSX·XLS·JSON (설치된 xlsx, 필요할 때만 dynamic import).
// 서버 파싱: PPTX·DOCX·PDF (/api/meetings/extract-file, jszip·unpdf).
// 미지원(안내+우회): 구형 .ppt/.doc/.hwp·녹음(음성) — UnsupportedImport로 사유/방법 반환.

export interface ImportResult { text: string; note: string; }

/** 사용자에게 "왜 안 되고 어떻게 하라"는 안내를 담은 에러. */
export class UnsupportedImport extends Error {}

const TEXT_EXT = ["txt", "text", "md", "markdown", "log", "json", "vtt", "srt"];
const SHEET_EXT = ["xlsx", "xls", "xlsm", "csv", "tsv"];
const SERVER_EXT = ["pdf", "docx", "pptx"];   // 서버에서 파싱
const AUDIO_EXT = ["mp3", "m4a", "wav", "aac", "ogg", "flac", "webm", "amr", "opus", "wma"];

/** 임포트 UI의 accept 속성 — 지원 + 흔한 미지원(안내용)까지 포함해 선택은 되게. */
export const IMPORT_ACCEPT =
  ".txt,.md,.csv,.tsv,.xlsx,.xls,.json,.vtt,.srt,.pptx,.pdf,.docx,.ppt,.doc,.hwp,.mp3,.m4a,.wav";

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
  // ── 미지원: 구형 바이너리 오피스/한글 (ZIP 아님) ──
  if (["ppt", "doc", "hwp", "hwpx", "key", "pages", "rtf", "odt"].includes(ext)) {
    throw new UnsupportedImport(
      `구형 형식(.${ext})은 자동 추출이 안 됩니다. .pptx/.docx로 다시 저장하거나, 내용을 복사해 붙여넣어 주세요.`,
    );
  }

  // ── 서버 파싱: PPTX·DOCX·PDF ──
  if (SERVER_EXT.includes(ext)) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/meetings/extract-file", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new UnsupportedImport(json.error ?? `추출 실패 (${res.status})`);
    return { text: json.text ?? "", note: json.note ?? file.name };
  }

  // ── 클라 파싱: 스프레드시트/CSV (xlsx는 필요할 때만 로드) ──
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
