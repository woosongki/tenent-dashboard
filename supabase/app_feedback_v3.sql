-- ============================================================
-- APP FEEDBACK v3 — 의견은 로그인 사용자 누구나 자유 작성, 열람은 관리자 전원
-- 기존 app_feedback.sql 적용 후 추가로 실행. 멱등.
-- 변경:
--   1) organization_id NOT NULL → nullable (조직 미소속자도 메모 작성 가능)
--   2) insert 정책: is_org_member → 로그인만 OK
--   3) select/update/delete 정책: 특정 조직 admin → 어떤 조직이든 owner/admin이면 OK
-- ============================================================

alter table public.app_feedback
  alter column organization_id drop not null;

drop policy if exists "app_feedback: 멤버 작성"   on public.app_feedback;
drop policy if exists "app_feedback: 로그인 작성" on public.app_feedback;
drop policy if exists "app_feedback: admin 조회"  on public.app_feedback;
drop policy if exists "app_feedback: admin 수정"  on public.app_feedback;
drop policy if exists "app_feedback: admin 삭제"  on public.app_feedback;

create policy "app_feedback: 로그인 작성" on public.app_feedback
  for insert with check (auth.uid() is not null);

create policy "app_feedback: admin 조회" on public.app_feedback
  for select using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

create policy "app_feedback: admin 수정" on public.app_feedback
  for update using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

create policy "app_feedback: admin 삭제" on public.app_feedback
  for delete using (
    exists (
      select 1 from public.organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );
