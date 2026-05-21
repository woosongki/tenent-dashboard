"use client";

import { useState, useRef } from "react";
import type { VerifyBrief, VerifyProgressEvent } from "@/lib/verify/types";

interface CorpCandidate {
  code: string;
  name: string;
  stockCode: string | null;
  matchType: "exact" | "startsWith" | "contains" | "reverse";
  ceoName?: string | null;
  estDate?: string | null;
  industry?: string | null;
}

function formatEstDate(d: string | null | undefined): string {
  if (!d || d.length !== 8) return "";
  return `${d.slice(0, 4)}.${d.slice(4, 6)}`;
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-cyan-400 text-[#0a0a0a]",
  B: "bg-yellow-300 text-[#0a0a0a]",
  C: "bg-orange-400 text-white",
  D: "bg-rose-500 text-white",
  "미확인": "bg-slate-200 text-[#0a0a0a]",
};

const GRADE_LABELS: Record<string, string> = {
  A: "A — 안전",
  B: "B — 조건부",
  C: "C — 주의",
  D: "D — 부적합",
  "미확인": "미확인",
};

const MATCH_LABELS: Record<string, string> = {
  exact: "정확 일치",
  startsWith: "시작 일치",
  contains: "포함",
  reverse: "유사",
};

function GradeChip({ grade }: { grade: string }) {
  const cls = GRADE_COLORS[grade] ?? "bg-slate-200 text-[#0a0a0a]";
  return (
    <span className={`inline-flex items-center border-[2px] border-[#0a0a0a] px-3 py-1 text-[13px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] ${cls}`}>
      {GRADE_LABELS[grade] ?? grade}
    </span>
  );
}

function SourceChip({ src }: { src: string }) {
  const map: Record<string, string> = {
    "검증됨": "bg-cyan-100 text-cyan-800",
    "보도 확인": "bg-yellow-100 text-yellow-800",
    "참고": "bg-slate-100 text-slate-600",
    "확인 불가": "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block border border-[#0a0a0a]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase ${map[src] ?? "bg-slate-100"}`}>
      {src}
    </span>
  );
}

function BriefCard({ brief }: { brief: VerifyBrief }) {
  const toB = (n: number | null) => (n === null ? "—" : `${Math.round(n / 1e8).toLocaleString()}억`);
  return (
    <div className="brutal mt-6 bg-white">
      <div className="border-b-[3px] border-[#0a0a0a] bg-[#FAF7EC] px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-[22px]">{brief.companyName}</h2>
          <GradeChip grade={brief.grade} />
          <span className="text-[12px] text-slate-500">{brief.corpCls} · DART {brief.corpCode}</span>
          {brief.notionUrl && (
            <a href={brief.notionUrl} target="_blank" rel="noopener noreferrer"
              className="ml-auto border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1 text-[11px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
              Notion 열기 →
            </a>
          )}
        </div>
        <p className="mt-2 text-[13px] text-slate-700">{brief.executiveSummary}</p>
        <p className="mt-1 text-[11px] text-slate-500">{brief.gradeReason}</p>
      </div>

      <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
        <div className="border-b-[2px] border-r-[0px] border-[#0a0a0a] p-5 md:border-r-[2px]">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">재무 요약</p>
          <div className="space-y-2">
            {brief.financials.years.map((y) => (
              <div key={y.year} className="flex items-center justify-between text-[12px]">
                <span className="font-mono font-bold text-slate-400">{y.year}</span>
                <span className="font-mono font-extrabold">{toB(y.revenue)}</span>
                <span className={`font-mono text-[11px] ${(y.operatingProfit ?? 0) < 0 ? "text-rose-500" : "text-cyan-700"}`}>
                  {y.operatingProfit === null ? "—" : `${y.revenue ? ((y.operatingProfit / y.revenue) * 100).toFixed(1) : "—"}%`}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-[#0a0a0a]/10 pt-2 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">부채비율</span>
              <span className="font-mono font-bold">{brief.financials.ratios.debtRatio?.toFixed(0) ?? "—"}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">유동비율</span>
              <span className="font-mono font-bold">{brief.financials.ratios.currentRatio?.toFixed(0) ?? "—"}%</span>
            </div>
            {brief.financials.ratios.isCapitalImpaired && (
              <div className="mt-1 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 border border-rose-200">⚠ 자본잠식</div>
            )}
          </div>
        </div>

        <div className="border-b-[2px] border-r-[0px] border-[#0a0a0a] p-5 md:border-r-[2px]">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">핵심 리스크</p>
          {brief.riskFlags.length === 0 ? (
            <p className="text-[12px] text-slate-400">감지된 리스크 없음</p>
          ) : (
            <ul className="space-y-2">
              {brief.riskFlags.slice(0, 5).map((r, i) => (
                <li key={i} className="text-[12px]">
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 font-mono font-extrabold text-rose-500">!</span>
                    <div>
                      <span className="font-bold">{r.flag}</span>
                      <div className="mt-0.5 flex items-center gap-1">
                        <SourceChip src={r.source} />
                        <span className="text-[11px] text-slate-500">{r.description}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-b-[2px] border-[#0a0a0a] p-5">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">집중 영역</p>
          {brief.focusAreas.length === 0 ? (
            <p className="text-[12px] text-slate-400">식별된 집중 영역 없음</p>
          ) : (
            <ul className="space-y-2">
              {brief.focusAreas.slice(0, 3).map((f, i) => (
                <li key={i} className="text-[12px]">
                  <div className="flex items-start gap-1.5">
                    <span className="inline-block shrink-0 border border-violet-400 bg-violet-50 px-1 py-0.5 text-[9px] font-bold text-violet-700">{f.category}</span>
                    <div>
                      <p className="font-bold">{f.summary}</p>
                      <p className="text-[11px] text-slate-500">{f.implication}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {brief.questions.length > 0 && (
        <div className="p-5">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">
            미팅 질문지 ({brief.questions.length}개)
          </p>
          <ol className="space-y-1.5">
            {brief.questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]">
                <span className="font-mono font-extrabold text-slate-400 shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                <div>
                  <span className="inline-block border border-[#0a0a0a]/15 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold mr-1.5">{q.category}</span>
                  {q.question}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="border-t-[2px] border-[#0a0a0a] bg-[#FAF7EC] px-6 py-2 text-[10px] text-slate-400">
        수집 시각: {new Date(brief.collectedAt).toLocaleString("ko-KR")} · DART {brief.recentDisclosures.length}건 · 뉴스 {brief.news.length}건 (최근 3개월)
      </div>
    </div>
  );
}

export default function VerifyClient() {
  type Phase = "input" | "candidates" | "running" | "done";

  const [phase, setPhase] = useState<Phase>("input");
  const [company, setCompany] = useState("");
  const [memo, setMemo] = useState("");
  const [candidates, setCandidates] = useState<CorpCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [brief, setBrief] = useState<VerifyBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  function addLog(msg: string) {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function reset() {
    setPhase("input");
    setCandidates([]);
    setLogs([]);
    setBrief(null);
    setError(null);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || searching) return;
    setSearching(true);
    setError(null);
    setCandidates([]);

    try {
      const res = await fetch(`/api/verify/search-corps?q=${encodeURIComponent(company.trim())}`);
      const data = (await res.json()) as { candidates: CorpCandidate[] };
      if (data.candidates.length === 0) {
        setError(`"${company}" 매칭되는 법인이 DART에 없습니다. DART 미등록 법인(소상공인 등)일 수 있습니다.`);
      } else {
        setCandidates(data.candidates);
        setPhase("candidates");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 오류");
    } finally {
      setSearching(false);
    }
  }

  async function runVerification(corp: CorpCandidate) {
    setPhase("running");
    setLogs([]);
    setBrief(null);
    setError(null);
    addLog(`선택: ${corp.name} (${corp.code}) ${corp.stockCode ? "· 상장 " + corp.stockCode : "· 비상장"}`);

    try {
      const response = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: corp.name, corpCode: corp.code, memo }),
      });
      if (!response.ok || !response.body) {
        setError("서버 오류가 발생했습니다");
        setPhase("candidates");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as VerifyProgressEvent;
            if (event.type === "progress") addLog(event.message);
            if (event.type === "error") {
              setError(event.message);
              addLog(`오류: ${event.message}`);
            }
            if (event.type === "result" && event.data) {
              setBrief(event.data as VerifyBrief);
              setPhase("done");
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    }
  }

  return (
    <div>
      {/* ───────── 1단계: 회사명 입력 ───────── */}
      {phase === "input" && (
        <form onSubmit={handleSearch} className="brutal bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-500">
                회사명 또는 키워드
              </label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                placeholder="예: 신세계, 다이소, 무신사..."
                className="w-full border-[2px] border-[#0a0a0a] bg-[#FAF7EC] px-4 py-3 font-mono text-[15px] font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                disabled={searching} required autoFocus />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-500">
                검증 사유 메모 (선택)
              </label>
              <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 2026 하반기 입점 협상 예정"
                className="w-full border-[2px] border-[#0a0a0a] bg-white px-4 py-3 font-mono text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
            </div>
            <button type="submit" disabled={searching || !company.trim()}
              className="shrink-0 border-[2px] border-[#0a0a0a] bg-yellow-300 px-8 py-3 text-[13px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50">
              {searching ? "법인+대표자 조회 중..." : "법인 검색"}
            </button>
          </div>
        </form>
      )}

      {/* ───────── 2단계: 후보 선택 ───────── */}
      {phase === "candidates" && (
        <div className="brutal bg-white">
          <div className="border-b-[2px] border-[#0a0a0a] bg-[#FAF7EC] px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-500">
                "{company}" 검색 결과 · {candidates.length}건
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">검증할 법인을 클릭하세요. 상장사가 가장 풍부한 데이터를 제공합니다.</p>
            </div>
            <button onClick={reset}
              className="border-[2px] border-[#0a0a0a] bg-white px-3 py-1.5 text-[11px] font-bold hover:bg-slate-50">
              ← 다시 검색
            </button>
          </div>
          <ul className="divide-y divide-[#0a0a0a]/10 max-h-[480px] overflow-y-auto">
            {candidates.map((corp) => (
              <li key={corp.code}>
                <button onClick={() => runVerification(corp)}
                  className="w-full text-left px-6 py-3 hover:bg-yellow-50 transition-colors flex items-start gap-3">
                  <span className="font-mono text-[10px] text-slate-400 shrink-0 w-16 mt-0.5">{corp.code}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[14px]">{corp.name}</span>
                      {corp.stockCode && (
                        <span className="inline-block border border-cyan-400 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-extrabold text-cyan-800">
                          상장 {corp.stockCode}
                        </span>
                      )}
                      <span className="inline-block border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                        {MATCH_LABELS[corp.matchType]}
                      </span>
                    </div>
                    {/* 대표자 + 설립일 + 업종 — DART에서 비동기로 채워짐 */}
                    {(corp.ceoName || corp.estDate || corp.industry) && (
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        {corp.ceoName && (
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">대표</span>
                            <span className="font-bold text-slate-700">{corp.ceoName}</span>
                          </span>
                        )}
                        {corp.estDate && (
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">설립</span>
                            <span className="font-mono">{formatEstDate(corp.estDate)}</span>
                          </span>
                        )}
                        {corp.industry && (
                          <span className="flex items-center gap-1">
                            <span className="text-slate-400">업종</span>
                            <span className="font-mono">{corp.industry}</span>
                          </span>
                        )}
                      </div>
                    )}
                    {!corp.ceoName && !corp.estDate && (
                      <div className="mt-1 text-[10px] text-slate-300">DART 기본정보 없음</div>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0 mt-0.5">검증 →</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ───────── 3단계: 진행 + 결과 ───────── */}
      {(phase === "running" || phase === "done") && (
        <div>
          {logs.length > 0 && (
            <div className="brutal-sm bg-[#0a0a0a] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">
                  진행 로그
                </p>
                <button onClick={reset} className="text-[10px] text-slate-500 hover:text-white font-bold">← 처음으로</button>
              </div>
              <div className="max-h-48 overflow-y-auto font-mono text-[12px] text-green-400 space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i}>
                    <span className="text-slate-600">&gt; </span>
                    {log}
                  </div>
                ))}
                {phase === "running" && (
                  <div className="animate-pulse">
                    <span className="text-slate-600">&gt; </span>
                    <span className="text-yellow-400">처리 중...</span>
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
          {brief && <BriefCard brief={brief} />}
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div className="brutal-sm mt-4 border-rose-500 bg-rose-50 p-4">
          <p className="font-bold text-rose-700">{error}</p>
        </div>
      )}
    </div>
  );
}
