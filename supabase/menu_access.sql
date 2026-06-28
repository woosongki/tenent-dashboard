-- ============================================================
-- 사용자별 사이드바 메뉴 접근 제어 (숨김 + 차단)
-- organization_members.hidden_menus: 그 사용자가 볼 수 없는 메뉴 key 목록(deny-list).
-- 빈 배열 = 전부 보임. owner/admin은 앱 로직에서 제한 면제.
-- 멱등.
-- ============================================================
alter table public.organization_members
  add column if not exists hidden_menus text[] not null default '{}';

comment on column public.organization_members.hidden_menus is
  '사용자별 숨김 메뉴 key 목록(deny-list). 사이드바 비노출 + 라우트 차단. owner/admin 면제.';
