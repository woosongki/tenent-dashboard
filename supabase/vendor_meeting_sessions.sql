-- ============================================================
-- VENDOR_MEETING_SESSIONS — 업체별 N차 미팅 세션
-- 한 vendor_meetings row(=업체) 아래 여러 세션(1차, 2차, ...) 누적.
-- raw_text: 미팅 도구/메모장에서 그대로 붙여넣은 원본.
-- extracted: 룰 기반 파싱 결과 (questions/unmetNeeds/actionItems/quotes/keywords).
-- 여러 번 실행해도 안전(멱등).
-- ============================================================

create table if not exists public.vendor_meeting_sessions (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null references public.vendor_meetings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_index   int  not null,                       -- 1, 2, 3...  (업체 내부 카운터)
  title           text,                                -- 선택: "1차 - 실무진 방문"
  held_at         date not null default current_date,  -- 미팅 실제 진행일
  raw_text        text not null,                       -- 원문 전체
  extracted       jsonb,                               -- { questions, unmetNeeds, actionItems, quotes, keywords }
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (meeting_id, session_index)
);

create index if not exists idx_vms_meeting_held
  on public.vendor_meeting_sessions (meeting_id, held_at desc, session_index desc);
create index if not exists idx_vms_org_recent
  on public.vendor_meeting_sessions (organization_id, held_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_vendor_meeting_sessions_updated_at') then
    create trigger trg_vendor_meeting_sessions_updated_at
      before update on public.vendor_meeting_sessions
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.vendor_meeting_sessions enable row level security;

drop policy if exists "vms: 멤버 조회"  on public.vendor_meeting_sessions;
drop policy if exists "vms: 멤버 생성"  on public.vendor_meeting_sessions;
drop policy if exists "vms: 멤버 수정"  on public.vendor_meeting_sessions;
drop policy if exists "vms: admin 삭제" on public.vendor_meeting_sessions;

create policy "vms: 멤버 조회"
  on public.vendor_meeting_sessions for select
  using (public.is_org_member(organization_id));

create policy "vms: 멤버 생성"
  on public.vendor_meeting_sessions for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

create policy "vms: 멤버 수정"
  on public.vendor_meeting_sessions for update
  using (public.is_org_member(organization_id));

create policy "vms: admin 삭제"
  on public.vendor_meeting_sessions for delete
  using (public.is_org_admin(organization_id));
