-- ============================================================
-- VENDOR_MEETINGS v2 — Stage 2 (미팅 Q&A · 메모)
-- meeting_payload: { questions: [{ id, q, a }], memo, completedAt }
-- 여러 번 실행해도 안전(멱등).
-- ============================================================

alter table public.vendor_meetings
  add column if not exists meeting_payload jsonb;

-- stage 컬럼이 비어 있을 일은 없지만, 안전한 체크 제약(이미 있으면 무시)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vendor_meetings_stage_check'
  ) then
    alter table public.vendor_meetings
      add constraint vendor_meetings_stage_check
      check (stage in ('brief', 'meeting', 'proposal', 'done'));
  end if;
end $$;
