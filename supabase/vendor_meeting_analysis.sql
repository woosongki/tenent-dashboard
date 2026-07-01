-- ============================================================
-- VENDOR_MEETINGS — AI 심층분석 결과 캐시 컬럼
-- 업체미팅 상세의 "AI 심층분석"(Claude SWOT/등급)을 on-demand로 1회 실행하고
-- 결과를 이 컬럼에 저장 → 재방문 시 LLM 재호출 없이 캐시 표시(비용 0).
-- 여러 번 실행해도 안전(멱등).
-- ============================================================

alter table public.vendor_meetings
  add column if not exists analysis    jsonb;        -- { grade, gradeReason, riskFlags, focusAreas, questions, executiveSummary }

alter table public.vendor_meetings
  add column if not exists analyzed_at timestamptz;  -- 마지막 분석 실행 시각
