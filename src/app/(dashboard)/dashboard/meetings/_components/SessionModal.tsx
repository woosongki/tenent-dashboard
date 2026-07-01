"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VendorSessionRow } from "./VendorDetail";
import { extractSession } from "@/lib/meetings/extract";
import { extractTextFromFile, UnsupportedImport, IMPORT_ACCEPT } from "@/lib/meetings/importFile";

const MAX_CHARS = 50_000;

interface Props {
  meetingId: string;
  nextIndex: number;
  initial?: VendorSessionRow;
  onClose: () => void;
  onSaved: (s: VendorSessionRow) => void;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 세션 추가/편집 모달 — 원문 붙여넣기 + 실시간 추출 미리보기.
 * ESC · 배경 클릭으로 닫힘. 저장 중엔 잠금.
 */
export default function SessionModal({ meetingId, nextIndex, initial, onClose, onSaved }: Props) {
  const isEdit = !!initial;

  const [rawText, setRawText] = useState(initial?.raw_text ?? "");
  const [heldAt, setHeldAt] = useState(initial?.held_at ?? todayISO());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 파일 → 텍스트 추출 후 원문 칸에 이어붙임(50,000자 상한). 미지원 형식은 안내 메시지.
  async function importFile(file: File) {
    if (saving) return;
    setError(null); setImportInfo(null);
    try {
      const { text, note } = await extractTextFromFile(file);
      const clean = text.trim();
      if (!clean) { setError(`${file.name}에서 읽을 텍스트가 없습니다.`); return; }
      setRawText((prev) => {
        const merged = prev.trim() ? `${prev.trim()}\n\n${clean}` : clean;
        if (merged.length > MAX_CHARS) {
          setImportInfo(`${note} 불러옴 · 50,000자 초과분은 잘렸습니다.`);
          return merged.slice(0, MAX_CHARS);
        }
        setImportInfo(`${note} 불러옴 (${clean.length.toLocaleString()}자)`);
        return merged;
      });
    } catch (e) {
      if (e instanceof UnsupportedImport) setError(e.message);
      else setError(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ESC 로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 클라이언트 사이드 미리보기 — 서버가 동일 로직으로 재계산해서 저장.
  const preview = useMemo(() => {
    const t = rawText.trim();
    if (t.length < 5) return null;
    return extractSession(t);
  }, [rawText]);

  async function submit() {
    if (!rawText.trim()) {
      setError("원문을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/meetings/${meetingId}/sessions/${initial!.id}`
        : `/api/meetings/${meetingId}/sessions`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawText.trim(),
          heldAt,
          title: title.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "저장 실패");
        return;
      }
      onSaved(json.session as VendorSessionRow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={() => { if (!saving) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="brutal bg-[#FAF7EC] w-full max-w-[1440px] h-[92vh] max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* 헤더 */}
        <header className="flex items-center justify-between gap-3 border-b-[3px] border-[#0a0a0a] bg-white px-5 py-3">
          <div className="flex items-baseline gap-3">
            <span className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-2 py-0.5 text-[11px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a]">
              {nextIndex}차
            </span>
            <h2 className="font-display text-[20px] text-[#0a0a0a]">
              {isEdit ? "세션 편집" : "새 세션 추가"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => { if (!saving) onClose(); }}
            aria-label="닫기"
            className="border-[2px] border-[#0a0a0a] bg-white px-2 py-1 text-[12px] font-extrabold hover:bg-rose-300"
          >
            ×
          </button>
        </header>

        {/* 본문 — 좌: 입력 · 우: 미리보기 */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] min-h-0 overflow-hidden">
          {/* 좌측 */}
          <div className="border-b-[2px] lg:border-b-0 lg:border-r-[2px] border-[#0a0a0a]/15 p-5 flex flex-col gap-3 min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                  미팅 날짜
                </label>
                <input
                  type="date"
                  value={heldAt}
                  onChange={(e) => setHeldAt(e.target.value)}
                  disabled={saving}
                  className="block w-full max-w-full min-w-0 border-[2px] border-[#0a0a0a] bg-white px-2 py-1.5 font-mono text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                  세션 제목 (선택)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 실무진 방문"
                  maxLength={120}
                  disabled={saving}
                  className="block w-full max-w-full min-w-0 border-[2px] border-[#0a0a0a] bg-white px-2 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                  원문 — 붙여넣기 또는 파일 불러오기
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={IMPORT_ACCEPT}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                    className="border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[11px] font-extrabold hover:bg-yellow-100 disabled:opacity-50"
                    title="TXT·CSV·XLSX·PPTX·DOCX·PDF 지원 (구형 .ppt/.doc·녹음은 안내)"
                  >
                    📎 파일 불러오기
                  </button>
                </div>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                onDragOver={(e) => { e.preventDefault(); if (!saving) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) importFile(f); }}
                placeholder={`TXT · 메모장 · 손메모 타이핑 어떤 것이든\n\n· 파일 불러오기: TXT·CSV·XLSX·PPTX·DOCX·PDF (또는 여기로 드래그)\n· 문장 단위(마침표/개행)로 자동 분리\n· "필요", "어렵다", "다음에", "?" 같은 마커로 언맷니즈/질문/액션 자동 추출`}
                disabled={saving}
                className={`flex-1 resize-none border-[2px] bg-white p-4 font-mono text-[14px] leading-7 text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-60 ${dragOver ? "border-yellow-500 ring-2 ring-yellow-300" : "border-[#0a0a0a]"}`}
              />
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-[10px] font-mono text-emerald-700 min-h-[1em]">{importInfo}</p>
                <p className="text-[10px] font-mono text-[#0a0a0a]/45 whitespace-nowrap">
                  {rawText.length.toLocaleString()} / 50,000자
                </p>
              </div>
            </div>
          </div>

          {/* 우측 — 미리보기 */}
          <div className="p-5 overflow-y-auto min-h-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-3">
              추출 미리보기
            </p>
            {!preview ? (
              <p className="text-[12px] text-[#0a0a0a]/55">
                원문을 붙여넣으면 카테고리별 추출이 여기 실시간으로 표시됩니다.
              </p>
            ) : (
              <div className="space-y-3">
                <PreviewSection label="언맷니즈" color="bg-yellow-200" items={preview.unmetNeeds.map((l) => l.text)} />
                <PreviewSection label="질문" color="bg-cyan-200" items={preview.questions.map((l) => l.text)} />
                <PreviewSection label="액션" color="bg-emerald-200" items={preview.actionItems.map((l) => l.text)} />
                <PreviewSection label="인용" color="bg-violet-200" items={preview.quotes.map((l) => l.text)} italic />
                {preview.keywords.length > 0 && (
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-1.5">
                      키워드
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.keywords.slice(0, 12).map((k) => (
                        <span
                          key={k.word}
                          className="inline-flex items-center gap-1 border-[1.5px] border-[#0a0a0a] bg-white px-1.5 py-0 text-[10.5px] font-bold"
                        >
                          {k.word}
                          <span className="font-mono text-[9px] text-[#0a0a0a]/55">{k.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <footer className="border-t-[3px] border-[#0a0a0a] bg-white px-5 py-3 flex items-center justify-between gap-3">
          {error ? (
            <p className="text-[12px] font-bold text-rose-700">{error}</p>
          ) : (
            <p className="text-[10.5px] font-mono text-[#0a0a0a]/55">
              저장하면 서버 측에서 동일 룰로 재추출 후 보관됩니다.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { if (!saving) onClose(); }}
              className="border-[2px] border-[#0a0a0a] bg-white px-4 py-2 text-[12px] font-extrabold hover:bg-[#FAF7EC]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !rawText.trim()}
              className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-5 py-2 text-[12px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "저장 중..." : isEdit ? "저장" : `${nextIndex}차 저장`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PreviewSection({
  label,
  color,
  items,
  italic = false,
}: {
  label: string;
  color: string;
  items: string[];
  italic?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block border-[2px] border-[#0a0a0a] ${color} px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider`}>
          {label}
        </span>
        <span className="font-mono text-[10px] text-[#0a0a0a]/55">{items.length}</span>
      </div>
      <ul className="space-y-1 pl-1">
        {items.slice(0, 8).map((t, i) => (
          <li key={i} className={`text-[12.5px] leading-snug text-[#0a0a0a] ${italic ? "italic" : ""}`}>
            {t}
          </li>
        ))}
        {items.length > 8 && (
          <li className="text-[10px] font-mono text-[#0a0a0a]/45">...외 {items.length - 8}건</li>
        )}
      </ul>
    </div>
  );
}
