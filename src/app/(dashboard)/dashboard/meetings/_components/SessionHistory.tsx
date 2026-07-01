"use client";

import { useState } from "react";
import type { VendorSessionRow } from "./VendorDetail";

interface Props {
  meetingId: string;
  sessions: VendorSessionRow[];
  onEdit: (s: VendorSessionRow) => void;
  onDelete: (sid: string) => void;
}

/**
 * 세션 히스토리 — N차부터 역순.
 * 각 카드: 헤더(N차/날짜/제목) + 카테고리별 추출 + 원문 접힘.
 */
export default function SessionHistory({ sessions, onEdit, onDelete, meetingId }: Props) {
  if (sessions.length === 0) {
    return null; // 상단 Insights 블록이 안내를 대체
  }

  return (
    <section>
      <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-3">
        세션 히스토리 ({sessions.length}차)
      </p>
      <div className="space-y-4">
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            meetingId={meetingId}
            onEdit={() => onEdit(s)}
            onDelete={() => onDelete(s.id)}
          />
        ))}
      </div>
    </section>
  );
}

function SessionCard({
  session,
  meetingId,
  onEdit,
  onDelete,
}: {
  session: VendorSessionRow;
  meetingId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ex = session.extracted;

  async function handleDelete() {
    if (!confirm(`${session.session_index}차 세션을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/sessions/${session.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "삭제 실패");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="brutal bg-white">
      {/* 헤더 */}
      <header className="flex items-center justify-between gap-3 border-b-[2px] border-[#0a0a0a]/15 px-5 py-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-2 py-0.5 text-[11px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a]">
            {session.session_index}차
          </span>
          <span className="font-mono text-[12px] font-bold text-[#0a0a0a]">
            {session.held_at}
          </span>
          {session.title && (
            <span className="truncate text-[12.5px] font-bold text-[#0a0a0a]/80">
              · {session.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[10.5px] font-extrabold hover:bg-yellow-300"
          >
            편집
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[10.5px] font-extrabold hover:bg-rose-300 disabled:opacity-50"
          >
            {deleting ? "..." : "삭제"}
          </button>
        </div>
      </header>

      {/* 카테고리별 추출 */}
      <div className="p-5 space-y-4">
        {ex ? (
          <>
            {ex.unmetNeeds.length > 0 && (
              <CategoryBlock label="언맷니즈" color="bg-yellow-200" count={ex.unmetNeeds.length}>
                {ex.unmetNeeds.map((l, i) => (
                  <li key={i} className="text-[13px] font-bold text-[#0a0a0a] leading-snug">{l.text}</li>
                ))}
              </CategoryBlock>
            )}
            {ex.questions.length > 0 && (
              <CategoryBlock label="질문" color="bg-cyan-200" count={ex.questions.length}>
                {ex.questions.map((l, i) => (
                  <li key={i} className="text-[13px] text-[#0a0a0a] leading-snug">{l.text}</li>
                ))}
              </CategoryBlock>
            )}
            {ex.actionItems.length > 0 && (
              <CategoryBlock label="액션" color="bg-emerald-200" count={ex.actionItems.length}>
                {ex.actionItems.map((l, i) => (
                  <li key={i} className="text-[13px] text-[#0a0a0a] leading-snug">{l.text}</li>
                ))}
              </CategoryBlock>
            )}
            {ex.quotes.length > 0 && (
              <CategoryBlock label="인용" color="bg-violet-200" count={ex.quotes.length}>
                {ex.quotes.map((l, i) => (
                  <li key={i} className="text-[12.5px] italic text-[#0a0a0a]/85 leading-snug">{l.text}</li>
                ))}
              </CategoryBlock>
            )}
            {ex.keywords.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-1.5">
                  이 세션 키워드
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ex.keywords.slice(0, 10).map((k) => (
                    <span
                      key={k.word}
                      className="inline-flex items-center gap-1 border-[1.5px] border-[#0a0a0a] bg-[#FAF7EC] px-1.5 py-0 text-[10.5px] font-bold"
                    >
                      {k.word}
                      <span className="font-mono text-[9px] text-[#0a0a0a]/55">{k.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {ex.unmetNeeds.length + ex.questions.length + ex.actionItems.length + ex.quotes.length === 0 && (
              <p className="text-[12px] text-[#0a0a0a]/55">
                원문에서 카테고리 마커가 잡히지 않았습니다. 아래 원문을 펼쳐서 확인하세요.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-[#0a0a0a]/55">추출 데이터 없음</p>
        )}

        {/* 원문 */}
        <div className="pt-3 border-t-[2px] border-[#0a0a0a]/10">
          <button
            type="button"
            onClick={() => setRawOpen((v) => !v)}
            className="flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/70 hover:text-[#0a0a0a]"
          >
            <span>원문</span>
            <span className="font-mono text-[10px] text-[#0a0a0a]/45">
              ({session.raw_text.length.toLocaleString()}자)
            </span>
            <span>{rawOpen ? "▲" : "▼"}</span>
          </button>
          {rawOpen && (
            <pre className="mt-2 max-h-[400px] overflow-y-auto whitespace-pre-wrap border-[2px] border-[#0a0a0a]/25 bg-[#FAF7EC] p-3 font-mono text-[12px] leading-relaxed text-[#0a0a0a]/85">
              {session.raw_text}
            </pre>
          )}
        </div>
      </div>
    </article>
  );
}

function CategoryBlock({
  label,
  color,
  count,
  children,
}: {
  label: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`inline-block border-[2px] border-[#0a0a0a] ${color} px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider`}>
          {label}
        </span>
        <span className="font-mono text-[10px] text-[#0a0a0a]/55">{count}</span>
      </div>
      <ul className="space-y-1 pl-1">{children}</ul>
    </div>
  );
}
