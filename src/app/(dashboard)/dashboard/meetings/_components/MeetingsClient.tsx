"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecentMeetingItem } from "@/lib/meetings/recent";

export interface ContactSeed {
  brand: string;
  company: string | null;
  field: string | null;
  stage: string | null;
  manager: string | null;
  hopeStore: string | null;
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
  recent: RecentMeetingItem[];
}

function fmtKoreanDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
  return raw;
}

/**
 * 랜딩 페이지 — 업체 검색·추가 + 지금까지 쌓인 업체 리스트.
 * 브리프 생성이 완료되면 상세 페이지(/dashboard/meetings/[id])로 자동 이동.
 * 세션 관리는 상세 페이지에서 이루어짐.
 */
export default function MeetingsClient({ contacts, recent }: Props) {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [selectedCorpCode, setSelectedCorpCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // typeahead
  const [showSuggest, setShowSuggest] = useState(false);
  const [candidates, setCandidates] = useState<CorpCandidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const candDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (candDebounceRef.current) clearTimeout(candDebounceRef.current);
    const q = brand.trim();
    candDebounceRef.current = setTimeout(async () => {
      if (q.length < 2) {
        setCandidates([]);
        return;
      }
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

  async function runBrief(targetBrand: string, corpCode?: string | null) {
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
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "수집 실패");
        return;
      }
      // 브리프 완료 → 상세 페이지로 즉시 이동. 세션은 거기서 쌓기.
      router.push(`/dashboard/meetings/${json.row.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    runBrief(brand);
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

  return (
    <main className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 bg-[#FAF7EC]">
      <div className="max-w-[1480px] mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="font-display text-[42px] sm:text-[52px] leading-[1] text-[#0a0a0a]">
            업체미팅
          </h1>
          <p className="mt-1 text-[13px] text-[#0a0a0a]/70">
            업체별 N차 미팅 원문을 붙여넣어 언맷니즈·질문·액션을 누적 정리합니다.
          </p>
        </div>

        {/* 신규 업체 등록 폼 */}
        <form onSubmit={handleSubmit} className="brutal bg-white p-6 mb-6 relative">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
            + 새 업체 등록 (DART 사전자료 자동 수집)
          </p>
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
                autoComplete="off"
              />

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
              {loading ? "수집 중..." : "등록 후 상세로"}
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
        </form>

        {error && (
          <div className="brutal-sm mb-6 border-rose-500 bg-rose-50 p-4">
            <p className="font-bold text-rose-700">{error}</p>
          </div>
        )}

        {/* 진행 중 업체 리스트 */}
        {recent.length > 0 ? (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                진행 중 업체 ({recent.length})
              </p>
              <p className="font-mono text-[10px] text-[#0a0a0a]/45">
                최근 세션 기준 정렬
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/meetings/${r.id}`}
                  className="brutal bg-white p-4 hover:bg-yellow-50 transition-colors block"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className="font-display text-[20px] text-[#0a0a0a] truncate">
                      {r.brand}
                    </h3>
                    <span className="shrink-0 border-[2px] border-[#0a0a0a] bg-yellow-300 px-1.5 py-0 text-[10px] font-extrabold">
                      {r.sessionCount}차
                    </span>
                  </div>
                  {r.company && r.company !== r.brand && (
                    <p className="font-mono text-[10.5px] text-[#0a0a0a]/55 truncate">
                      · {r.company}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[11px] text-[#0a0a0a]/70">
                    {r.lastSessionAt
                      ? `마지막 미팅 ${r.lastSessionAt}`
                      : "세션 없음 · 사전자료만 수집됨"}
                  </p>
                  {r.stage === "done" && (
                    <span className="mt-2 inline-block border-[2px] border-[#0a0a0a] bg-emerald-300 px-1.5 py-0 text-[9.5px] font-extrabold uppercase tracking-wider">
                      완료
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <div className="space-y-4">
            <div className="brutal-sm bg-[#F1ECDB]/60 p-6 text-center">
              <p className="font-display text-[22px] text-[#0a0a0a]">
                아직 등록된 업체가 없습니다
              </p>
              <p className="mt-1 text-[12px] text-[#0a0a0a]/60 max-w-xl mx-auto">
                위 검색창에서 브랜드/회사명을 입력하면 DART 사전자료가 수집되고
                상세 페이지에서 1차 미팅 원문을 붙여넣어 시작할 수 있습니다.
              </p>
            </div>
            <div className="brutal-sm bg-white p-5">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                작업 흐름
              </p>
              <ol className="space-y-1.5 text-[12.5px] text-[#0a0a0a]/80 list-decimal list-inside">
                <li>브랜드 검색 → 컨택판/DART에서 선택 → 사전자료 수집</li>
                <li>상세 페이지에서 <b>+ 세션 추가</b> → 미팅 원문(TXT · 메모) 붙여넣기</li>
                <li>룰 기반 추출(언맷니즈 · 질문 · 액션)이 자동 정리, N차로 계속 누적</li>
                <li>DART 브리프는 상세 하단에 참고용으로 접혀 있음</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
