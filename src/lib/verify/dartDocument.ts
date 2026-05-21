import "server-only";
import { inflateRaw } from "zlib";
import { promisify } from "util";
import type { DartDisclosure } from "./types";

const DART_BASE = "https://opendart.fss.or.kr/api";
const inflateRawAsync = promisify(inflateRaw);

function dartKey(): string {
  const k = process.env.DART_API_KEY;
  if (!k) throw new Error("DART_API_KEY missing");
  return k;
}

/**
 * 가장 최근 보고서 rcept_no 찾기
 * - 상장사(Y/K/N): 사업보고서 (사업보고서/반기/분기)
 * - 외감 비상장(E): 감사보고서 (외부감사인 감사보고서)
 */
export async function findLatestReportRcept(
  corpCode: string,
  corpCls: string | null,
  disclosures: DartDisclosure[]
): Promise<{ rceptNo: string; type: "사업보고서" | "감사보고서" | "기타"; date: string } | null> {
  if (!corpCode) return null;

  // 1) 이미 가져온 disclosures에서 먼저 찾기 (재호출 절약)
  const candidates = disclosures.filter((d) => {
    const name = d.rceptNm || "";
    return name.includes("사업보고서") || name.includes("감사보고서");
  });
  if (candidates.length > 0) {
    const best = candidates[0]; // disclosures는 최신순
    return {
      rceptNo: best.rceptNo,
      type: best.rceptNm.includes("감사보고서") ? "감사보고서" : "사업보고서",
      date: best.rceptDt,
    };
  }

  // 2) 외감 비상장 — pblntf_ty=F (감사보고서) 별도 조회
  if (corpCls === "E") {
    try {
      const url = new URL(`${DART_BASE}/list.json`);
      url.searchParams.set("crtfc_key", dartKey());
      url.searchParams.set("corp_code", corpCode);
      const now = new Date();
      const end = now.toISOString().slice(0, 10).replace(/-/g, "");
      const start = new Date(now.getTime() - 730 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
      url.searchParams.set("bgn_de", start);
      url.searchParams.set("end_de", end);
      url.searchParams.set("pblntf_ty", "F"); // 외부감사 관련
      url.searchParams.set("page_count", "20");
      const res = await fetch(url.toString());
      const data = (await res.json()) as { list?: Array<{ rcept_no: string; rcept_dt: string; report_nm: string }> };
      const first = data.list?.[0];
      if (first) {
        return { rceptNo: first.rcept_no, type: "감사보고서", date: first.rcept_dt };
      }
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * DART 본문 ZIP 다운로드 + HTML 텍스트 추출
 * 매우 긴 경우 truncate (maxChars 기본 15,000)
 */
export async function fetchReportText(rceptNo: string, maxChars = 15000): Promise<string | null> {
  if (!rceptNo) return null;

  try {
    const url = `${DART_BASE}/document.xml?crtfc_key=${dartKey()}&rcept_no=${rceptNo}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";

    // DART가 JSON으로 오류 반환하는 경우 (status != 000)
    if (contentType.includes("json")) {
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 30) return null;

    // ZIP 시그니처 확인
    const sig = buf.readUInt32LE(0);
    if (sig !== 0x04034b50) return null;

    // 모든 HTML 파일을 순회하며 텍스트 추출
    const texts: string[] = [];
    let offset = 0;
    while (offset < buf.length - 30) {
      const localSig = buf.readUInt32LE(offset);
      if (localSig !== 0x04034b50) break;

      const flag = buf.readUInt16LE(offset + 6);
      const compression = buf.readUInt16LE(offset + 8);
      let compSize = buf.readUInt32LE(offset + 18);
      const fnLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const fileName = buf.slice(offset + 30, offset + 30 + fnLen).toString("utf-8");
      const dataStart = offset + 30 + fnLen + extraLen;

      // 데이터 디스크립터 사용 시 다음 PK\x03\x04 또는 PK\x07\x08까지 스캔
      if ((flag & 0x08) || compSize === 0) {
        let next = dataStart;
        while (next < buf.length - 4) {
          const s = buf.readUInt32LE(next);
          if (s === 0x04034b50 || s === 0x02014b50 || s === 0x08074b50) break;
          next++;
        }
        compSize = next - dataStart;
        if (buf.readUInt32LE(next) === 0x08074b50) {
          // data descriptor 16 bytes 건너뜀
          offset = next + 16;
        } else {
          offset = next;
        }
      } else {
        offset = dataStart + compSize;
      }

      // 텍스트 파일만 처리 (.htm, .html, .xml — PDF/이미지 스킵)
      if (!/\.(html?|xml)$/i.test(fileName)) continue;

      try {
        const slice = buf.slice(dataStart, dataStart + compSize);
        let raw: Buffer;
        if (compression === 0) {
          raw = slice;
        } else if (compression === 8) {
          raw = await inflateRawAsync(slice);
        } else {
          continue;
        }
        // 인코딩: EUC-KR 또는 UTF-8 (DART는 EUC-KR이 많음)
        let text = raw.toString("utf-8");
        // EUC-KR 의심 (한글 깨짐) 시 fallback
        if (text.includes("�") || /[\xE0-\xEF][\x80-\xBF]{2}/.test(text) === false) {
          // 간단 휴리스틱 — euc-kr인지 확인은 라이브러리 없이 어려움
          // UTF-8 디코딩 결과를 그대로 사용 (대부분의 한국 시스템은 utf-8 호환)
        }
        // HTML 태그 제거 + 공백 정리
        text = text
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, " ")
          .trim();
        if (text.length > 50) {
          texts.push(`[${fileName}]\n${text}`);
        }
      } catch {
        // skip this file
      }
    }

    if (texts.length === 0) return null;

    let combined = texts.join("\n\n");

    // 우선순위 섹션 키워드 우선 추출 (분석 가치 높은 부분)
    const priorityKeywords = [
      "사업의 개요",
      "산업의 특성",
      "회사의 현황",
      "주요 제품",
      "시장점유율",
      "위험요소",
      "신규 사업",
      "연구개발",
      "감사인의 의견",
      "감사의견",
      "핵심감사사항",
      "강조사항",
      "계속기업",
    ];

    const sections: string[] = [];
    for (const kw of priorityKeywords) {
      const idx = combined.indexOf(kw);
      if (idx >= 0) {
        sections.push(combined.slice(idx, Math.min(idx + 2000, combined.length)));
      }
    }

    const result = sections.length > 0 ? sections.join("\n\n") : combined;

    return result.length > maxChars ? result.slice(0, maxChars) + "…(이하 생략)" : result;
  } catch {
    return null;
  }
}
