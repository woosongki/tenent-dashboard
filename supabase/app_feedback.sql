-- ============================================================
-- APP FEEDBACK — 팀원 의견·개선 제안 (작성=전원, 열람=관리자만)
-- 여러 번 실행해도 안전(멱등).
-- ============================================================

create table if not exists public.app_feedback (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  author_email    text,
  category        text,                              -- 개선제안 | 버그 | 칭찬 | 기타
  message         text not null,
  status          text not null default 'new',       -- new(신규) | seen(확인) | done(완료)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_app_feedback_org on public.app_feedback(organization_id, status, created_at desc);

-- updated_at 트리거
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_app_feedback_updated_at') then
    create trigger trg_app_feedback_updated_at before update on public.app_feedback
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── RLS — 작성은 조직원 전원, 열람·수정·삭제는 관리자만 ──
alter table public.app_feedback enable row level security;

drop policy if exists "app_feedback: 멤버 작성"  on public.app_feedback;
drop policy if exists "app_feedback: admin 조회" on public.app_feedback;
drop policy if exists "app_feedback: admin 수정" on public.app_feedback;
drop policy if exists "app_feedback: admin 삭제" on public.app_feedback;

create policy "app_feedback: 멤버 작성"  on public.app_feedback for insert with check (public.is_org_member(organization_id));
create policy "app_feedback: admin 조회" on public.app_feedback for select using (public.is_org_admin(organization_id));
create policy "app_feedback: admin 수정" on public.app_feedback for update using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "app_feedback: admin 삭제" on public.app_feedback for delete using (public.is_org_admin(organization_id));
