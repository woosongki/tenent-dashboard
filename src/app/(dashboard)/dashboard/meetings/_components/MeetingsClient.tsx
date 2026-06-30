"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BriefCard, { type BriefRow } from "./BriefCard";

export interface ContactSeed {
  brand: string;
  company: string | null;
  field: string | null;
  stage: string | null;
  manager: string | null;
  hopeStore: string | null;
}

export interface RecentBrief {
  id: string;
  brand: string;
  company: string | null;
  summary: string | null;
  createdAt: string;
}

interface CorpCandidate {
  code: string;
  name: string;
  stockCode: string | null;
  matchType: "exact" | "startsWith" | "contains" | "reverse";
  ceoName?: string | null;
  estDate?: string | null;
  industry?: string | null;
}

interface Props {
  contacts: ContactSeed[];
  recent: RecentBrief[];
}

function fmtKoreanDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
  return raw;
}

export default function MeetingsClient({ contacts, recent: initialRecent }: Props) {
  const [brand, setBrand] = useState("");
  const [selectedCorpCode, setSelectedCorpCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<BriefRow | null>(null);
  const [cached, setCached] = useState(false);
  const [recent, setRecent] = useState<RecentBrief[]>(initialRecent);

  // typeahead
  const [showSuggest, setShowSuggest] = useState(false);
  const [candidates, setCandidates] = useState<CorpCandidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const candDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // popup-contacts 매칭 (즉시 필터)
  const contactSuggests = useMemo(() => {
    const q = brand.trim().toLowerCase();
    if (!q) return [];
    return contacts
      .filter(
        (c) =>
          c.brand.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [brand, contacts]);

  // DART 후보 fetch (300ms debounce, 3자 이상)
  useEffect(() => {
    if (candDebounceRef.current) clearTimeout(candDebounceRef.current);
    const q = brand.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    candDebounceRef.current = setTimeout(async () => {
      setCandLoading(true);
      try {
        const res = await fetch(`/api/meetings/candidates?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (res.ok) setCandidates((json.candidates as CorpCandidate[]) ?? []);
        else setCandidates([]);
      } catch {
        setCandidates([]);
      } finally {
        setCandLoading(false);
      }
    }, 300);
    return () => {
      if (candDebounceRef.current) clearTimeout(candDebounceRef.current);
    };
  }, [brand]);

  async function runBrief(targetBrand: string, force = false, corpCode?: string | null) {
    if (!targetBrand.trim() || loading) return;
    setLoading(true);
    setError(null);
    setShowSuggest(false);

    try {
      const res = await fetch("/api/meetings/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: targetBrand.trim(),
          corpCode: corpCode ?? selectedCorpCode ?? undefined,
          force,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "수집 실패");
        return;
      }
      setRow(json.row as BriefRow);
      setCached(Boolean(json.cached));
      // 최근 목록 갱신 (중복 제거 후 맨 앞)
      setRecent((prev) => {
        const filtered = prev.filter((r) => r.id !== json.row.id);
        const newEntry: RecentBrief = {
          id: json.row.id,
          brand: json.row.brand,
          company: json.row.company,
          summary: json.row.brief_summary,
          createdAt: json.row.created_at,
        };
        return [newEntry, ...filtered].slice(0, 12);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    runBrief(brand, false);
  }

  function pickContact(c: ContactSeed) {
    setBrand(c.brand);
    setSelectedCorpCode(null);
    setShowSuggest(false);
  }

  function pickCandidate(c: CorpCandidate) {
    setBrand(c.name);
    setSelectedCorpCode(c.code);
    setShowSuggest(false);
  }

  function pickRecent(r: RecentBrief) {
    setBrand(r.brand);
    setSelectedCorpCode(null);
    setShowSuggest(false);
    runBrief(r.brand, false, null);
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 bg-[#FAF7EC]">
      <div className="max-w-[1480px] mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="font-display text-[42px] sm:text-[52px] leading-[1] text-[#0a0a0a]">
            업체미팅
          </h1>
          <p className="mt-1 text-[13px] text-[#0a0a0a]/70">
            Stage 1 · 사전 자료 자동 수집 — DART · 뉴스 · 검색 트렌드를 한 페이지 브리프로
          </p>
        </div>

        {/* 검색 폼 */}
        <form onSubmit={handleSubmit} className="brutal bg-white p-6 mb-6 relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 relative">
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                브랜드명 또는 회사명
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setSelectedCorpCode(null);
                  setShowSuggest(true);
                }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                placeholder="예: 다이소, 무신사, 키링몬스터..."
                className="w-full border-[2px] border-[#0a0a0a] bg-[#FAF7EC] px-4 py-3 font-mono text-[15px] font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                disabled={loading}
                required
                autoFocus
                autoComplete="off"
              />

              {/* typeahead 드롭다운 */}
              {showSuggest && (contactSuggests.length > 0 || candidates.length > 0 || candLoading) && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-[360px] overflow-y-auto border-[2px] border-[#0a0a0a] bg-white shadow-[3px_3px_0_0_#0a0a0a]">
                  {contactSuggests.length > 0 && (
                    <div>
                      <p className="px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 bg-[#FAF7EC] border-b border-[#0a0a0a]/15">
                        컨택판 ({contactSuggests.length})
                      </p>
                      {contactSuggests.map((c) => (
                        <button
                          key={`ct-${c.brand}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickContact(c)}
                          className="block w-full text-left px-3 py-2 hover:bg-yellow-300 border-b border-[#0a0a0a]/10"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-[13px] text-[#0a0a0a]">{c.brand}</span>
                            {c.company && c.company !== c.brand && (
                              <span className="font-mono text-[10.5px] text-[#0a0a0a]/55">· {c.company}</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex gap-1.5 flex-wrap">
                            {c.field && <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">{c.field}</span>}
                            {c.stage && <span className="text-[9.5px] font-bold uppercase tracking-wider text-cyan-700">{c.stage}</span>}
                            {c.manager && <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">담당 {c.manager}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {candidates.length > 0 && (
                    <div>
                      <p className="px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 bg-[#FAF7EC] border-b border-[#0a0a0a]/15">
                        DART 후보 ({candidates.length})
                      </p>
                      {candidates.map((c) => (
                        <button
                          key={`dart-${c.code}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickCandidate(c)}
                          className="block w-full text-left px-3 py-2 hover:bg-yellow-300 border-b border-[#0a0a0a]/10"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-[13px] text-[#0a0a0a]">{c.name}</span>
                            <span className="font-mono text-[10px] text-[#0a0a0a]/45">{c.code}</span>
                            {c.stockCode && (
                              <span className="border border-[#0a0a0a] bg-emerald-200 px-1 text-[9px] font-extrabold">상장</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex gap-2 flex-wrap text-[10px] text-[#0a0a0a]/55 font-mono">
                            {c.ceoName && <span>대표 {c.ceoName}</span>}
                            {c.estDate && <span>설립 {fmtKoreanDate(c.estDate)}</span>}
                            {c.industry && <span>업종 {c.industry}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {candLoading && candidates.length === 0 && contactSuggests.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-[#0a0a0a]/55 font-mono">DART 검색 중...</p>
                  )}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !brand.trim()}
              className="shrink-0 border-[2px] border-[#0a0a0a] bg-yellow-300 px-8 py-3 text-[13px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "수집 중..." : "브리프 생성"}
            </button>
          </div>
          {selectedCorpCode && (
            <p className="mt-2 text-[11px] font-mono text-[#0a0a0a]/55">
              DART corp_code 고정: <span className="font-bold text-[#0a0a0a]">{selectedCorpCode}</span>
              <button
                type="button"
                onClick={() => setSelectedCorpCode(null)}
                className="ml-2 underline decoration-2 underline-offset-2 hover:bg-yellow-300"
              >
                해제
              </button>
            </p>
          )}

          {/* 최근 브리프 칩 */}
          {recent.length > 0 && (
            <div className="mt-4 pt-4 border-t-[2px] border-[#0a0a0a]/15 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/40">
                최근 브리프
              </span>
              {recent.slice(0, 8).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickRecent(r)}
                  className="text-[11px] font-bold border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] px-2.5 py-1 hover:bg-cyan-300 transition-colors"
                  title={r.summary ?? undefined}
                >
                  {r.brand}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* 오류 */}
        {error && (
          <div className="brutal-sm mb-6 border-rose-500 bg-rose-50 p-4">
            <p className="font-bold text-rose-700">{error}</p>
          </div>
        )}

        {/* 결과 */}
        {row && (
          <BriefCard
            row={row}
            cached={cached}
            refreshing={loading}
            onRefresh={() => runBrief(row.brand, true, row.corp_code)}
          />
        )}

        {/* 빈 상태 */}
        {!row && !loading && !error && (
          <div className="space-y-4">
            <div className="brutal-sm bg-[#F1ECDB]/50 p-6 text-center">
              <p className="font-display text-[20px] text-[#0a0a0a]">미팅 전 사전 자료를 한 번에 모으세요</p>
              <p className="mt-1 text-[12px] text-[#0a0a0a]/55 max-w-xl mx-auto">
                브랜드명 입력 → 컨택판 + DART 후보에서 선택 → 5초 이내 1페이지 브리프.
                같은 브랜드 24시간 내 재조회는 캐시 사용 (외부 API 호출 0).
              </p>
            </div>
            <div className="brutal-sm bg-white p-5">
              <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                수집 항목
              </p>
              <ul className="space-y-1.5 text-[12.5px] text-[#0a0a0a]/80">
                <li><b>DART</b> — 정식명, 대표자, 설립일, 상장구분, 사업자번호, 본사 주소, 홈페이지</li>
                <li><b>재무 추이</b> — 최근 3년 매출·영업이익 (외감 신고 법인)</li>
                <li><b>공시</b> — 최근 2년 공시 리스트 (DART 링크)</li>
                <li><b>뉴스</b> — 최근 3개월 뉴스, 카테고리별 그룹 + 신뢰도 뱃지</li>
                <li><b>검색 트렌드</b> — 12개월 네이버 검색량 + 모멘텀 (Rising / Stable / Declining)</li>
              </ul>
              <p className="mt-3 text-[10.5px] font-mono text-[#0a0a0a]/45">
                ※ Stage 1은 데이터 수집만 — LLM 분석은 Stage 2(질문 자동 생성)에서 진행
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
