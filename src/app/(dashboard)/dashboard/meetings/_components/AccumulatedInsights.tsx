"use client";

import type { AccumulatedInsights as InsightsType } from "@/lib/meetings/extract";

interface Props {
  insights: InsightsType;
  sessionCount: number;
}

/**
 * 상세 페이지 최상단 — DART 브리프 위에 놓이는 "핵심" 블록.
 * 세션이 쌓일수록 정보량이 커짐.
 * 세션 0개면 안내 상태만.
 */
export default function AccumulatedInsights({ insights, sessionCount }: Props) {
  if (sessionCount === 0) {
    return (
      <section className="brutal bg-[#F1ECDB]/60 p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-2">
          핵심 · 언맷니즈 & 액션
        </p>
        <p className="font-display text-[22px] text-[#0a0a0a]">
          아직 미팅 세션이 없습니다
        </p>
        <p className="mt-1 text-[12.5px] text-[#0a0a0a]/60 max-w-xl">
          우측 상단 <b>세션 추가</b> 버튼으로 1차 미팅 원문(TXT · 손메모 타이핑) 을 붙여넣어 시작하세요.
          아래 DART 브리프는 참고용이며, 미팅이 쌓일수록 이 자리에 언맷니즈와 액션이 자동으로 정리됩니다.
        </p>
      </section>
    );
  }

  const { recurringNeeds, openQuestions, actionLog, topKeywords } = insights;
  const hasAny =
    recurringNeeds.length > 0 ||
    openQuestions.length > 0 ||
    actionLog.length > 0 ||
    topKeywords.length > 0;

  if (!hasAny) {
    return (
      <section className="brutal bg-white p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-2">
          핵심 · 언맷니즈 & 액션
        </p>
        <p className="text-[13px] text-[#0a0a0a]/70">
          세션 원문에서 추출할 신호가 아직 잡히지 않았어요. 미팅 대화체(질문 · 필요/부족 · 다음에 등)에 가까운 원문을 넣으면 더 잘 잡힙니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
          핵심 · 언맷니즈 & 액션
        </p>
        <p className="font-mono text-[10px] text-[#0a0a0a]/45">
          {sessionCount}차까지 누적
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 반복 언맷니즈 (2세션 이상 등장) 또는 최신 세션 unmet top5 fallback */}
        <div className="brutal bg-yellow-300 p-5 lg:col-span-2">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/70">
              언맷니즈
            </span>
            <span className="font-mono text-[10px] text-[#0a0a0a]/55">
              {recurringNeeds.length > 0 && recurringNeeds[0].sessions.length >= 2
                ? "2회 이상 반복"
                : "최신 세션 기준"}
            </span>
          </div>
          {recurringNeeds.length === 0 ? (
            <p className="text-[12.5px] text-[#0a0a0a]/70">
              언맷니즈 마커(필요/부족/어렵/원한다/문제 등) 가 원문에 없어요.
            </p>
          ) : (
            <ul className="space-y-2">
              {recurringNeeds.slice(0, 6).map((n, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 border-[2px] border-[#0a0a0a] bg-white px-1.5 py-0 text-[9.5px] font-extrabold">
                    {n.sessions.length}회
                  </span>
                  <p className="text-[13px] font-bold text-[#0a0a0a] leading-snug">
                    {n.text}
                  </p>
                  <span className="ml-auto shrink-0 font-mono text-[9.5px] text-[#0a0a0a]/55">
                    {n.sessions.map((s) => `${s}차`).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 액션 로그 */}
        <div className="brutal bg-cyan-300 p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/70 mb-3">
            액션 로그
          </p>
          {actionLog.length === 0 ? (
            <p className="text-[12px] text-[#0a0a0a]/70">액션 항목 없음</p>
          ) : (
            <ul className="space-y-2">
              {actionLog.slice(0, 8).map((a, i) => (
                <li key={i} className="text-[12px] text-[#0a0a0a] leading-snug">
                  <span className="font-mono text-[9.5px] text-[#0a0a0a]/55 mr-1.5">
                    {a.sessionIndex}차·{a.heldAt.slice(5)}
                  </span>
                  <span className="font-bold">{a.text}</span>
                </li>
              ))}
              {actionLog.length > 8 && (
                <li className="font-mono text-[10px] text-[#0a0a0a]/45">
                  ...외 {actionLog.length - 8}건
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 미해결 질문 다발 */}
        <div className="brutal bg-white p-5 lg:col-span-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-3">
            질문 다발 (최신 세션 우선)
          </p>
          {openQuestions.length === 0 ? (
            <p className="text-[12px] text-[#0a0a0a]/55">추출된 질문 없음</p>
          ) : (
            <ol className="space-y-1.5">
              {openQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                  <span className="shrink-0 font-mono text-[10px] font-extrabold text-[#0a0a0a]/45 w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[#0a0a0a]">{q.text}</span>
                  <span className="ml-auto shrink-0 font-mono text-[9.5px] text-[#0a0a0a]/45">
                    {q.sessionIndex}차
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 주요 키워드 */}
        <div className="brutal bg-violet-200 p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/70 mb-3">
            주요 키워드
          </p>
          {topKeywords.length === 0 ? (
            <p className="text-[12px] text-[#0a0a0a]/70">키워드 없음</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topKeywords.slice(0, 12).map((k) => (
                <span
                  key={k.word}
                  className="inline-flex items-center gap-1 border-[2px] border-[#0a0a0a] bg-white px-2 py-0.5 text-[11px] font-extrabold"
                >
                  {k.word}
                  <span className="font-mono text-[9.5px] text-[#0a0a0a]/55">{k.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
