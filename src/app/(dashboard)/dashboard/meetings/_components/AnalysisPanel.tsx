"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/verify/analyzer";
import type { VerifyGrade } from "@/lib/verify/types";

const GRADE_STYLE: Record<VerifyGrade, string> = {
  A: "bg-emerald-400 text-emerald-950",
  B: "bg-sky-400 text-sky-950",
  C: "bg-amber-400 text-amber-950",
  D: "bg-rose-500 text-white",
  미확인: "bg-slate-300 text-slate-800",
};

/**
 * 업체미팅 상세 — AI 심층분석 패널.
 * 평소엔 LLM 호출 0. owner/admin이 버튼을 눌러야만 Claude 분석 실행(비용 발생),
 * 결과는 서버에 캐시되어 재방문 시 무료로 표시.
 */
export default function AnalysisPanel({
  meetingId, canAnalyze, initial, analyzedAt: initialAt,
}: {
  meetingId: string;
  canAnalyze: boolean;
  initial: AnalysisResult | null;
  analyzedAt: string | null;
}) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(initial);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(initialAt);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(force: boolean) {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `분석 실패 (${res.status})`); return; }
      setAnalysis(json.analysis as AnalysisResult);
      setAnalyzedAt(json.analyzedAt ?? new Date().toISOString());
    } catch { setErr("분석 요청 중 오류"); }
    finally { setLoading(false); }
  }

  return (
    <section className="brutal bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
            AI 심층분석 · Claude
          </span>
          {analyzedAt && (
            <span className="font-mono text-[10px] text-[#0a0a0a]/45">
              {new Date(analyzedAt).toLocaleString("ko-KR")} 기준
            </span>
          )}
          <span className="border-[1.5px] border-[#0a0a0a] bg-[#FAF7EC] px-1.5 py-0 text-[9px] font-extrabold">
            요청 시에만 호출 · 평소 비용 0
          </span>
        </div>
        {canAnalyze && (
          <button
            type="button"
            onClick={() => run(analysis ? true : false)}
            disabled={loading}
            className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-3.5 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
          >
            {loading ? "분석 중…" : analysis ? "다시 분석" : "🧠 AI 심층분석 실행"}
          </button>
        )}
      </div>

      {err && <p className="px-5 pb-4 text-[12px] text-rose-600">{err}</p>}

      {!analysis && !err && (
        <div className="border-t-[2px] border-[#0a0a0a]/15 px-5 py-6 text-[12.5px] text-[#0a0a0a]/60">
          {canAnalyze
            ? "DART 재무·공시·최대주주 + 뉴스·검색트렌드 + 이랜드 내부 입점이력·자체 매출 벤치마크 + N차 미팅 대화(언맷니즈·질문)를 Claude가 교차 분석해 등급·리스크·집중검토·심화 질문을 도출합니다. 버튼을 눌러야만 실행됩니다(1회 호출 후 캐시)."
            : "아직 AI 분석이 없습니다. owner/admin이 실행하면 이 자리에 등급·리스크·집중검토·미팅 질문이 표시됩니다."}
        </div>
      )}

      {analysis && (
        <div className="border-t-[2px] border-[#0a0a0a]/15 p-5 space-y-4">
          {/* 등급 + 요약 */}
          <div className="flex items-start gap-3">
            <span className={`shrink-0 border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[20px] font-extrabold ${GRADE_STYLE[analysis.grade]}`}>
              {analysis.grade}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#0a0a0a] leading-snug">{analysis.executiveSummary}</p>
              {analysis.gradeReason && (
                <p className="mt-1 text-[11.5px] text-[#0a0a0a]/60">등급 근거: {analysis.gradeReason}</p>
              )}
            </div>
          </div>

          {/* 리스크 */}
          {analysis.riskFlags.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">리스크</p>
              <ul className="space-y-1.5">
                {analysis.riskFlags.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] leading-snug">
                    <span className="mt-0.5 shrink-0 border-[1.5px] border-rose-500 bg-rose-50 px-1.5 py-0 text-[9.5px] font-extrabold text-rose-700">
                      {r.flag}
                    </span>
                    <span className="text-[#0a0a0a]">{r.description}
                      <span className="ml-1 font-mono text-[9.5px] text-[#0a0a0a]/45">[{r.source}]</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 집중 검토 */}
          {analysis.focusAreas.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">집중 검토</p>
              <ul className="space-y-1.5">
                {analysis.focusAreas.map((f, i) => (
                  <li key={i} className="text-[12px] leading-snug">
                    <span className="border-[1.5px] border-[#0a0a0a] bg-white px-1.5 py-0 text-[9.5px] font-extrabold">{f.category}</span>
                    <span className="ml-1.5 font-bold text-[#0a0a0a]">{f.summary}</span>
                    <span className="text-[#0a0a0a]/70"> → {f.implication}</span>
                    <span className="ml-1 font-mono text-[9.5px] text-[#0a0a0a]/45">[{f.source}]</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 미팅 제안 질문 */}
          {analysis.questions.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">미팅 제안 질문</p>
              <ol className="space-y-1">
                {analysis.questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug">
                    <span className="shrink-0 font-mono text-[10px] font-extrabold text-[#0a0a0a]/40 w-5">{String(i + 1).padStart(2, "0")}</span>
                    <span><span className="font-mono text-[9.5px] text-[#0a0a0a]/45 mr-1">[{q.category}]</span>{q.question}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
