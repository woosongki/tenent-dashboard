"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BriefRow, MeetingPayload } from "./BriefCard";
import BriefCard from "./BriefCard";
import AccumulatedInsights from "./AccumulatedInsights";
import AnalysisPanel from "./AnalysisPanel";
import SessionHistory from "./SessionHistory";
import SessionModal from "./SessionModal";
import type { ExtractedSession } from "@/lib/meetings/extract";
import { aggregateSessions } from "@/lib/meetings/extract";

export type VendorRow = BriefRow;

export interface VendorSessionRow {
  id: string;
  meeting_id: string;
  session_index: number;
  title: string | null;
  held_at: string;              // YYYY-MM-DD
  raw_text: string;
  extracted: ExtractedSession | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  row: VendorRow;
  sessions: VendorSessionRow[];
  canAnalyze?: boolean;
}

export default function VendorDetail({ row: initialRow, sessions: initial, canAnalyze = false }: Props) {
  const [row, setRow] = useState<VendorRow>(initialRow);
  const [sessions, setSessions] = useState<VendorSessionRow[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false); // 항상 접힘이 기본
  const [briefRefreshing, setBriefRefreshing] = useState(false);
  const [editingSession, setEditingSession] = useState<VendorSessionRow | null>(null);

  async function refreshBrief() {
    setBriefRefreshing(true);
    try {
      const res = await fetch("/api/meetings/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: row.brand, corpCode: row.corp_code, force: true }),
      });
      const json = await res.json();
      if (res.ok && json.row) setRow(json.row as VendorRow);
    } finally {
      setBriefRefreshing(false);
    }
  }

  const insights = useMemo(
    () => aggregateSessions(sessions.map((s) => ({
      session_index: s.session_index,
      held_at: s.held_at,
      extracted: s.extracted,
    }))),
    [sessions]
  );

  const totalCount = sessions.length;
  const lastHeld = sessions[0]?.held_at ?? null;
  const stage = row.stage;
  const payload = row.meeting_payload as MeetingPayload | null;

  function addSession(next: VendorSessionRow) {
    setSessions((prev) => [next, ...prev]);
    setModalOpen(false);
  }
  function replaceSession(next: VendorSessionRow) {
    setSessions((prev) => prev.map((s) => (s.id === next.id ? next : s)));
    setEditingSession(null);
  }
  function removeSession(sid: string) {
    setSessions((prev) => prev.filter((s) => s.id !== sid));
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 bg-[#FAF7EC]">
      <div className="max-w-[1480px] mx-auto space-y-5">
        {/* ── 헤더 ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#0a0a0a]/55 mb-1">
              <Link href="/dashboard/meetings" className="hover:bg-yellow-300 underline decoration-2 underline-offset-2">
                업체미팅
              </Link>
              <span>›</span>
              <span>{row.brand}</span>
            </div>
            <h1 className="font-display text-[38px] sm:text-[52px] leading-[1] text-[#0a0a0a]">
              {row.brand}
            </h1>
            {row.company && row.company !== row.brand && (
              <p className="mt-1 font-mono text-[13px] font-bold text-[#0a0a0a]/55">
                · {row.company}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="border-[2px] border-[#0a0a0a] bg-white px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider">
                총 {totalCount}차
              </span>
              {lastHeld && (
                <span className="font-mono text-[11px] text-[#0a0a0a]/55">
                  마지막 미팅 {lastHeld}
                </span>
              )}
              {stage === "done" && (
                <span className="border-[2px] border-[#0a0a0a] bg-emerald-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                  완료
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-5 py-2.5 text-[13px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            + 세션 추가 ({totalCount + 1}차)
          </button>
        </div>

        {/* ── 1. Accumulated Insights (최상단) ── */}
        <AccumulatedInsights insights={insights} sessionCount={totalCount} />

        {/* ── 2. 세션 히스토리 ── */}
        <SessionHistory
          sessions={sessions}
          onEdit={(s) => setEditingSession(s)}
          onDelete={removeSession}
          onUpdate={replaceSession}
          meetingId={row.id}
        />

        {/* ── 3. AI 심층분석 (on-demand · 평소 비용 0) ── */}
        <AnalysisPanel
          meetingId={row.id}
          canAnalyze={canAnalyze}
          initial={row.analysis ?? null}
          analyzedAt={row.analyzed_at ?? null}
        />

        {/* ── 4. DART 브리프 (기본 접힘, 항상 최하단) ── */}
        <section className="brutal bg-white">
          <button
            type="button"
            onClick={() => setBriefOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#FAF7EC] transition-colors"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                참고 · DART 사전 자료
              </span>
              {row.brief_summary && (
                <span className="font-mono text-[11px] text-[#0a0a0a]/70 truncate">
                  {row.brief_summary}
                </span>
              )}
            </div>
            <span className="text-[11px] font-extrabold text-[#0a0a0a]/70">
              {briefOpen ? "접기 ▲" : "펼치기 ▼"}
            </span>
          </button>
          {briefOpen && (
            <div className="border-t-[2px] border-[#0a0a0a]/15 p-5">
              <BriefCard
                row={row}
                cached
                refreshing={briefRefreshing}
                onRefresh={refreshBrief}
              />
            </div>
          )}
        </section>

        {/* 레거시 meeting_payload (Q&A) — 데이터 있으면 참고용으로만 노출 */}
        {payload && payload.questions.length > 0 && (
          <details className="brutal-sm bg-white p-4">
            <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
              레거시 Q&A ({payload.questions.length}개) — 이전 버전 데이터
            </summary>
            <ul className="mt-3 space-y-2">
              {payload.questions.map((q) => (
                <li key={q.id} className="text-[12px]">
                  <p className="font-bold text-[#0a0a0a]">Q. {q.q}</p>
                  {q.a && <p className="mt-0.5 ml-3 font-mono text-[#0a0a0a]/70">A. {q.a}</p>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {modalOpen && (
        <SessionModal
          meetingId={row.id}
          nextIndex={totalCount + 1}
          onClose={() => setModalOpen(false)}
          onSaved={addSession}
        />
      )}
      {editingSession && (
        <SessionModal
          meetingId={row.id}
          nextIndex={editingSession.session_index}
          initial={editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={replaceSession}
        />
      )}
    </main>
  );
}
