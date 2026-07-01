"use client";

import { useState } from "react";
import type { VendorSessionRow } from "./VendorDetail";
import type { ExtractedSession, SessionCategory } from "@/lib/meetings/extract";

interface Props {
  meetingId: string;
  sessions: VendorSessionRow[];
  onEdit: (s: VendorSessionRow) => void;
  onDelete: (sid: string) => void;
  onUpdate: (s: VendorSessionRow) => void;
}

const EMPTY_EX: ExtractedSession = {
  questions: [], unmetNeeds: [], actionItems: [], quotes: [], facts: [], keywords: [],
};

// 표시 카테고리 → extracted 배열 키 + ExtractedLine.category 값
const CATS: { key: "unmetNeeds" | "questions" | "actionItems" | "quotes"; cat: SessionCategory; label: string; color: string; italic?: boolean }[] = [
  { key: "unmetNeeds", cat: "unmet", label: "언맷니즈", color: "bg-yellow-200" },
  { key: "questions", cat: "question", label: "질문", color: "bg-cyan-200" },
  { key: "actionItems", cat: "action", label: "액션", color: "bg-emerald-200" },
  { key: "quotes", cat: "quote", label: "인용", color: "bg-violet-200", italic: true },
];

/**
 * 세션 히스토리 — N차부터 역순.
 * 각 카드: 헤더(N차/날짜/제목) + 카테고리별 추출(수정/추가/삭제 가능) + 원문 접힘.
 */
export default function SessionHistory({ sessions, onEdit, onDelete, onUpdate, meetingId }: Props) {
  if (sessions.length === 0) return null; // 상단 Insights 블록이 안내를 대체

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
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </section>
  );
}

function SessionCard({
  session, meetingId, onEdit, onDelete, onUpdate,
}: {
  session: VendorSessionRow;
  meetingId: string;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (s: VendorSessionRow) => void;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ex, setEx] = useState<ExtractedSession>(session.extracted ?? EMPTY_EX);
  // 상위에서 세션(extracted)이 교체되면(원문 재추출 등) 렌더 중 동기화 — effect 없이(React 권장)
  const [seenEx, setSeenEx] = useState(session.extracted);
  if (session.extracted !== seenEx) { setSeenEx(session.extracted); setEx(session.extracted ?? EMPTY_EX); }

  async function handleDelete() {
    if (!confirm(`${session.session_index}차 세션을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/sessions/${session.id}`, { method: "DELETE" });
      if (res.ok) onDelete();
      else { const j = await res.json().catch(() => ({})); alert(j.error ?? "삭제 실패"); }
    } finally { setDeleting(false); }
  }

  // 추출 항목 변경 → 낙관적 반영 + 서버 저장(원문 미변경) + 상위 집계 갱신
  async function persist(next: ExtractedSession) {
    const prev = ex;
    setEx(next); setBusy(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/sessions/${session.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setEx(prev); alert(j.error ?? "저장 실패"); return; }
      setEx(j.session.extracted ?? next);
      onUpdate(j.session as VendorSessionRow);
    } catch { setEx(prev); alert("네트워크 오류"); }
    finally { setBusy(false); }
  }

  function editItem(key: typeof CATS[number]["key"], idx: number, text: string) {
    persist({ ...ex, [key]: ex[key].map((l, i) => (i === idx ? { ...l, text } : l)) });
  }
  function deleteItem(key: typeof CATS[number]["key"], idx: number) {
    persist({ ...ex, [key]: ex[key].filter((_, i) => i !== idx) });
  }
  function addItem(key: typeof CATS[number]["key"], cat: SessionCategory) {
    persist({ ...ex, [key]: [...ex[key], { text: "내용을 입력하세요", category: cat, keywords: [] }] });
  }

  const totalItems = ex.unmetNeeds.length + ex.questions.length + ex.actionItems.length + ex.quotes.length;

  return (
    <article className="brutal bg-white">
      {/* 헤더 */}
      <header className="flex items-center justify-between gap-3 border-b-[2px] border-[#0a0a0a]/15 px-5 py-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-2 py-0.5 text-[11px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a]">
            {session.session_index}차
          </span>
          <span className="font-mono text-[12px] font-bold text-[#0a0a0a]">{session.held_at}</span>
          {session.title && <span className="truncate text-[12.5px] font-bold text-[#0a0a0a]/80">· {session.title}</span>}
          {busy && <span className="font-mono text-[10px] text-[#0a0a0a]/45">저장 중…</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`border-[2px] border-[#0a0a0a] px-2.5 py-1 text-[10.5px] font-extrabold ${editMode ? "bg-yellow-300" : "bg-white hover:bg-yellow-100"}`}
          >
            {editMode ? "항목 편집 완료" : "✎ 항목 편집"}
          </button>
          <button type="button" onClick={onEdit}
            className="border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[10.5px] font-extrabold hover:bg-yellow-300"
            title="원문 편집(재추출)">원문</button>
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[10.5px] font-extrabold hover:bg-rose-300 disabled:opacity-50">
            {deleting ? "..." : "삭제"}
          </button>
        </div>
      </header>

      <div className="p-5 space-y-4">
        {editMode ? (
          <>
            <p className="text-[11px] text-[#0a0a0a]/55">
              항목을 직접 수정·삭제·추가할 수 있습니다. <b>원문을 다시 편집하면 자동 재추출되어 수동 변경분이 덮어써집니다.</b>
            </p>
            {CATS.map((c) => (
              <div key={c.key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`inline-block border-[2px] border-[#0a0a0a] ${c.color} px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider`}>{c.label}</span>
                  <span className="font-mono text-[10px] text-[#0a0a0a]/55">{ex[c.key].length}</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {ex[c.key].map((l, i) => (
                    <EditableItem
                      key={i}
                      text={l.text}
                      italic={c.italic}
                      disabled={busy}
                      onSave={(t) => editItem(c.key, i, t)}
                      onDelete={() => deleteItem(c.key, i)}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => addItem(c.key, c.cat)}
                  disabled={busy}
                  className="mt-1.5 border-[1.5px] border-dashed border-[#0a0a0a]/50 px-2 py-0.5 text-[11px] font-bold text-[#0a0a0a]/70 hover:bg-[#FAF7EC] disabled:opacity-50"
                >
                  + {c.label} 추가
                </button>
              </div>
            ))}
          </>
        ) : (
          <>
            {CATS.map((c) =>
              ex[c.key].length > 0 ? (
                <CategoryBlock key={c.key} label={c.label} color={c.color} count={ex[c.key].length}>
                  {ex[c.key].map((l, i) => (
                    <li key={i} className={`text-[13px] leading-snug text-[#0a0a0a] ${c.key === "unmetNeeds" ? "font-bold" : ""} ${c.italic ? "italic text-[#0a0a0a]/85" : ""}`}>{l.text}</li>
                  ))}
                </CategoryBlock>
              ) : null,
            )}
            {ex.keywords.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-1.5">이 세션 키워드</p>
                <div className="flex flex-wrap gap-1.5">
                  {ex.keywords.slice(0, 10).map((k) => (
                    <span key={k.word} className="inline-flex items-center gap-1 border-[1.5px] border-[#0a0a0a] bg-[#FAF7EC] px-1.5 py-0 text-[10.5px] font-bold">
                      {k.word}<span className="font-mono text-[9px] text-[#0a0a0a]/55">{k.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {totalItems === 0 && (
              <p className="text-[12px] text-[#0a0a0a]/55">
                추출된 항목이 없습니다. <b>✎ 항목 편집</b>으로 직접 추가하거나 <b>원문</b>을 펼쳐 확인하세요.
              </p>
            )}
          </>
        )}

        {/* 원문 */}
        <div className="pt-3 border-t-[2px] border-[#0a0a0a]/10">
          <button type="button" onClick={() => setRawOpen((v) => !v)}
            className="flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/70 hover:text-[#0a0a0a]">
            <span>원문</span>
            <span className="font-mono text-[10px] text-[#0a0a0a]/45">({session.raw_text.length.toLocaleString()}자)</span>
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

function EditableItem({
  text, italic, disabled, onSave, onDelete,
}: {
  text: string; italic?: boolean; disabled?: boolean;
  onSave: (t: string) => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState(text);
  const [seenText, setSeenText] = useState(text);
  if (text !== seenText) { setSeenText(text); setDraft(text); }
  function commit() {
    const t = draft.trim();
    if (!t) { setDraft(text); return; }
    if (t !== text) onSave(t);
  }
  return (
    <li className="flex items-start gap-1.5">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        disabled={disabled}
        className={`flex-1 border-[1.5px] border-[#0a0a0a]/30 bg-white px-2 py-1 text-[12.5px] text-[#0a0a0a] focus:outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-yellow-300 disabled:opacity-50 ${italic ? "italic" : ""}`}
      />
      <button type="button" onClick={onDelete} disabled={disabled}
        className="border-[1.5px] border-[#0a0a0a] bg-white px-1.5 py-1 text-[11px] font-extrabold leading-none hover:bg-rose-300 disabled:opacity-50"
        title="삭제">×</button>
    </li>
  );
}

function CategoryBlock({
  label, color, count, children,
}: { label: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`inline-block border-[2px] border-[#0a0a0a] ${color} px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider`}>{label}</span>
        <span className="font-mono text-[10px] text-[#0a0a0a]/55">{count}</span>
      </div>
      <ul className="space-y-1 pl-1">{children}</ul>
    </div>
  );
}
