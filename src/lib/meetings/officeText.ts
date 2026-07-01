import "server-only";
import JSZip from "jszip";
import { extractText } from "unpdf";

// PPTX·DOCX(=ZIP+XML)와 PDF에서 순수 텍스트 추출. 서버(node) 전용 — pdf.js·jszip 안정 경로.
// 구형 바이너리(.ppt/.doc)와 음성은 여기서 처리하지 않음(라우트에서 안내).

const MAX_OUT = 200_000; // 세션 원문 상한 여유분 (클라에서 50k로 다시 자름)

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

/** OOXML 문단(paraTag) 단위로 개행, 텍스트런(tag) 수집. w:t/w:p(docx), a:t/a:p(pptx). */
function runsFromXml(xml: string, tag: string, paraTag: string): string {
  const runRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const lines: string[] = [];
  for (const para of xml.split(new RegExp(`</${paraTag}>`))) {
    let buf = "";
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(para)) !== null) buf += m[1];
    const line = decodeXml(buf).trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  return xml ? runsFromXml(xml, "w:t", "w:p") : "";
}

async function pptxText(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)/)![1]) - Number(b.match(/(\d+)/)![1]));
  const out: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const xml = await zip.file(slides[i])!.async("string");
    const t = runsFromXml(xml, "a:t", "a:p").trim();
    if (t) out.push(`# 슬라이드 ${i + 1}\n${t}`);
  }
  return out.join("\n\n");
}

async function pdfText(buf: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
  return (typeof text === "string" ? text : (text as string[]).join("\n")).trim();
}

export async function extractOfficeText(buf: ArrayBuffer, ext: string): Promise<string> {
  let text = "";
  if (ext === "pdf") text = await pdfText(buf);
  else if (ext === "docx") text = await docxText(buf);
  else if (ext === "pptx") text = await pptxText(buf);
  else throw new Error(`지원하지 않는 형식: .${ext}`);
  return text.length > MAX_OUT ? text.slice(0, MAX_OUT) : text;
}
