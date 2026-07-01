import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { analyzeWithClaude, type AnalysisResult } from "@/lib/verify/analyzer";
import { fetchMajorShareholders } from "@/lib/verify/dart";
import { findExistingTenancy, buildSalesBenchmark } from "@/lib/verify/internal";
import { aggregateSessions, type ExtractedSession } from "@/lib/meetings/extract";
import type { MeetingBriefPayload } from "@/lib/meetings/brief";

/** 업체미팅 N차 세션에서 추출된 인사이트를 분석용 텍스트로 압축 (없으면 undefined). */
function buildMeetingContext(
  sessions: { session_index: number; held_at: string; extracted: ExtractedSession | null }[],
): string | undefined {
  if (sessions.length === 0) return undefined;
  const agg = aggregateSessions(sessions);
  const parts: string[] = [`${sessions.length}차 누적 (최근 미팅 ${sessions[0]?.held_at ?? "-"})`];
  if (agg.recurringNeeds.length) parts.push(`언맷니즈: ${agg.recurringNeeds.slice(0, 6).map((n) => n.text).join(" / ")}`);
  if (agg.openQuestions.length) parts.push(`미해결 질문: ${agg.openQuestions.slice(0, 6).map((q) => q.text).join(" / ")}`);
  if (agg.actionLog.length) parts.push(`액션: ${agg.actionLog.slice(0, 6).map((a) => (a.due ? `[${a.due}] ` : "") + a.text).join(" / ")}`);
  if (agg.topKeywords.length) parts.push(`반복 키워드: ${agg.topKeywords.slice(0, 10).map((k) => k.word).join(", ")}`);
  return parts.join("\n");
}

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/meetings/:id/analyze   body: { force?: boolean }
 *
 * 저장된 DART 브리프에 Claude 심층분석(등급·SWOT·리스크)을 on-demand로 실행.
 * - 평소엔 절대 호출되지 않음 → 비용 0. 사용자가 버튼을 눌러야만 LLM 호출.
 * - owner/admin만 실행(비용 보호). 결과는 행에 캐시 → 재방문·재조회 시 무료.
 * - force=true 일 때만 캐시 무시하고 재분석.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, role } = await getSessionContext();
  if (!user) return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (role !== "owner" && role !== "admin") {
    return Response.json(
      { error: "AI 심층분석은 owner/admin만 실행할 수 있습니다 (API 비용 보호)." },
      { status: 403 },
    );
  }

  const limited = rateLimit(`meetings-analyze:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (limited) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "meeting id 필요" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const supabase = await createClient();

  const { data: row, error: fErr } = await supabase
    .from("vendor_meetings")
    .select("id,brand,company,corp_code,brief_payload,analysis,analyzed_at")
    .eq("id", id)
    .maybeSingle();
  if (fErr) return Response.json({ error: fErr.message }, { status: 500 });
  if (!row) return Response.json({ error: "찾을 수 없음" }, { status: 404 });

  // 캐시 히트 — 이미 분석됨 & 강제 아님 → LLM 호출 0
  if (row.analysis && !body.force) {
    return Response.json({ analysis: row.analysis, analyzedAt: row.analyzed_at, cached: true });
  }

  const bp = row.brief_payload as MeetingBriefPayload | null;
  const hasData = !!bp && (!!bp.dart || (bp.financials?.length ?? 0) > 0 || (bp.news?.length ?? 0) > 0);
  if (!hasData) {
    return Response.json(
      { error: "DART 사전 자료가 없습니다. 브리프를 먼저 수집한 뒤 분석하세요." },
      { status: 400 },
    );
  }

  const companyName = bp!.company ?? row.company ?? row.brand;
  const brand = row.brand;

  // ── 심층화 입력 보강 (모두 무료: DART·내부 DB·세션) — LLM 호출은 아래 1회뿐 ──
  const [shareholders, internalHistory, sessRes] = await Promise.all([
    row.corp_code ? fetchMajorShareholders(row.corp_code).catch(() => []) : Promise.resolve([]),
    findExistingTenancy(companyName, brand).catch(() => ({ attraction: [], vendor: [] })),
    supabase.from("vendor_meeting_sessions")
      .select("session_index,held_at,extracted")
      .eq("meeting_id", id).order("session_index", { ascending: false }),
  ]);
  const salesBenchmark = buildSalesBenchmark(companyName, brand);
  const meetingContext = buildMeetingContext(
    (sessRes.data ?? []) as { session_index: number; held_at: string; extracted: ExtractedSession | null }[],
  );

  let analysis: AnalysisResult;
  try {
    analysis = await analyzeWithClaude({
      company: bp!.dart ?? null,
      companyName,
      financials: bp!.financials ?? [],
      disclosures: bp!.disclosures ?? [],
      shareholders,
      news: bp!.news ?? [],
      internalHistory,
      salesBenchmark,
      searchTrend: bp!.trend ?? null,
      meetingContext,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "분석 실패";
    return Response.json({ error: msg }, { status: 502 });
  }

  const analyzedAt = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("vendor_meetings")
    .update({ analysis, analyzed_at: analyzedAt })
    .eq("id", id);
  if (uErr) return Response.json({ error: uErr.message }, { status: 500 });

  return Response.json({ analysis, analyzedAt, cached: false });
}
