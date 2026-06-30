"use client";

import { useState } from "react";
import type { BriefRow, MeetingPayload, MeetingQA } from "./BriefCard";

interface Props {
  row: BriefRow;
  onUpdate: (row: BriefRow) => void;
}

const STAGE_LABEL: Record<string, string> = {
  brief: "1. 사전 자료",
  meeting: "2. 미팅 진행",
  proposal: "3. 제안 정리",
  done: "완료",
};
const STAGE_COLOR: Record<string, string> = {
  brief: "bg-cyan-300",
  meeting: "bg-yellow-300",
  proposal: "bg-violet-300",
  done: "bg-emerald-300",
};

function newId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function Stage2Section({ row, onUpdate }: Props) {
  const stage = row.stage;
  const payload: MeetingPayload = row.meeting_payload ?? {
    questions: [],
    memo: "",
    completedAt: null,
  };

  const [questions, setQuestions] = useState<MeetingQA[]>(payload.questions);
  const [memo, setMemo] = useState(payload.memo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isLocked = stage === "done";

  async function patch(body: {
    stage?: string;
    meeting_payload?: Partial<MeetingPayload>;
    autoSeed?: boolean;
  }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "저장 실패");
        return null;
      }
      const updated = json.row as BriefRow;
      onUpdate(updated);
      // 시드로 새로 받은 questions를 로컬에도 반영
      if (updated.meeting_payload) {
        setQuestions(updated.meeting_payload.questions);
        setMemo(updated.meeting_payload.memo);
      }
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function startMeeting() {
    await patch({ stage: "meeting", autoSeed: true });
  }

  async function save() {
    await patch({
      meeting_payload: { questions, memo },
    });
  }

  async function complete() {
    if (!confirm("미팅을 완료 처리하시겠어요? 이후엔 잠금(수정 불가)됩니다.")) return;
    await patch({
      stage: "done",
      meeting_payload: { questions, memo },
    });
  }

  async function reopen() {
    if (!confirm("완료된 미팅을 다시 편집 가능하게 전환할까요?")) return;
    await patch({ stage: "meeting" });
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, { id: newId(), q: "", a: "" }]);
  }
  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }
  function updateQ(id: string, patch: Partial<MeetingQA>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  // ── Stage 뱃지(헤더) + 본문 분기 ────────────────────────────────
  return (
    <section className="brutal bg-white p-6 mt-5">
      <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b-[2px] border-[#0a0a0a]/15">
        <div className="flex items-center gap-2">
          <span className={`border-[2px] border-[#0a0a0a] ${STAGE_COLOR[stage] ?? "bg-white"} px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0_0_#0a0a0a]`}>
            STAGE · {STAGE_LABEL[stage] ?? stage}
          </span>
          {payload.completedAt && (
            <span className="font-mono text-[10.5px] text-[#0a0a0a]/55">
              완료 {new Date(payload.completedAt).toLocaleString("ko-KR")}
            </span>
          )}
        </div>
        {savedAt && !saving && (
          <span className="font-mono text-[10px] text-[#0a0a0a]/45">
            저장 {savedAt}
          </span>
        )}
      </div>

      {error && (
        <div className="brutal-sm border-rose-500 bg-rose-50 p-3 mb-4">
          <p className="font-bold text-rose-700 text-[12px]">{error}</p>
        </div>
      )}

      {/* stage='brief' — CTA만 노출 */}
      {stage === "brief" && (
        <div className="text-center py-6">
          <p className="font-display text-[22px] text-[#0a0a0a] mb-1">미팅 준비 완료</p>
          <p className="text-[12.5px] text-[#0a0a0a]/60 mb-5 max-w-md mx-auto">
            위 브리프를 바탕으로 룰 기반 미팅 질문 3-5개가 자동 제안됩니다. 미팅 중 자유롭게 추가·수정·답변을 기록하세요.
          </p>
          <button
            type="button"
            onClick={startMeeting}
            disabled={saving}
            className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-8 py-3 text-[14px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
          >
            {saving ? "준비 중..." : "미팅 시작 ▸"}
          </button>
        </div>
      )}

      {/* stage='meeting' or 'done' — 질문/답변/메모 */}
      {(stage === "meeting" || stage === "done") && (
        <div className="space-y-5">
          {/* 질문 리스트 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                질문 {questions.length}개
              </p>
              {!isLocked && (
                <button
                  type="button"
                  onClick={addQuestion}
                  className="border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[10.5px] font-extrabold hover:bg-yellow-300"
                >
                  + 질문 추가
                </button>
              )}
            </div>
            {questions.length === 0 ? (
              <p className="text-[12px] text-[#0a0a0a]/55">질문이 없습니다. &lsquo;질문 추가&rsquo;로 직접 입력하세요.</p>
            ) : (
              <ul className="space-y-3">
                {questions.map((q, i) => (
                  <li key={q.id} className="brutal-sm bg-[#FAF7EC] p-3">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="font-mono text-[10px] font-extrabold text-[#0a0a0a]/45 w-5 text-right shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {q.category && (
                        <span className="border border-[#0a0a0a] bg-white px-1.5 py-0 text-[9.5px] font-extrabold uppercase tracking-wider shrink-0">
                          {q.category}
                        </span>
                      )}
                      <textarea
                        value={q.q}
                        onChange={(e) => updateQ(q.id, { q: e.target.value })}
                        placeholder="질문..."
                        rows={1}
                        disabled={isLocked}
                        className="flex-1 resize-y border-[2px] border-[#0a0a0a] bg-white px-2 py-1 font-bold text-[13px] text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-60"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
                          title="삭제"
                          className="shrink-0 border-[2px] border-[#0a0a0a] bg-white px-2 py-1 text-[10px] font-extrabold hover:bg-rose-300"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <textarea
                      value={q.a}
                      onChange={(e) => updateQ(q.id, { a: e.target.value })}
                      placeholder="답변·메모..."
                      rows={2}
                      disabled={isLocked}
                      className="ml-7 w-[calc(100%-2rem)] resize-y border-[2px] border-[#0a0a0a]/40 bg-white px-2 py-1.5 font-mono text-[12px] text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-60"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 메모 */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-2">
              추가 메모
            </p>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="미팅 중 자유 메모 — 분위기, 추가 약속, 다음 액션 등"
              rows={4}
              disabled={isLocked}
              className="w-full resize-y border-[2px] border-[#0a0a0a] bg-[#FAF7EC] px-3 py-2 font-mono text-[12.5px] text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-60"
            />
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-wrap gap-2 pt-3 border-t-[2px] border-[#0a0a0a]/15">
            {!isLocked ? (
              <>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="border-[2px] border-[#0a0a0a] bg-white px-5 py-2 text-[12px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={complete}
                  disabled={saving}
                  className="border-[2px] border-[#0a0a0a] bg-emerald-300 px-5 py-2 text-[12px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
                >
                  미팅 완료 ✓
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={reopen}
                disabled={saving}
                className="border-[2px] border-[#0a0a0a] bg-white px-5 py-2 text-[12px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
              >
                다시 편집
              </button>
            )}
            <p className="ml-auto self-center text-[10.5px] font-mono text-[#0a0a0a]/45">
              ※ Stage 3(제안 매장/공간)는 다음 단계로 추가 예정
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
