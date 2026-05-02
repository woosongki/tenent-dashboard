-- ============================================================
-- VENDOR LEASE — 업체리스트(일반임대) · 라이프스타일 탭
-- Notion 업체리스트(일반임대) DB → Supabase 단방향 싱크
-- ============================================================

create table if not exists public.vendor_lease (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                         -- 업체명 (title)
  types       text[] not null default '{}',          -- 유형 (multi_select)
  score       text,                                  -- 점수 (select)
  is_checked  boolean not null default false,        -- 체크박스
  status      text,                                  -- 상태 (status/select)
  link        text,                                  -- 링크 (url)
  contact     text,                                  -- 연락처 (phone_number)
  keyman      text,                                  -- 키맨 (rich_text)
  memo        text,                                  -- 기타 (rich_text)
  notion_url  text unique,                           -- Notion 페이지 URL (upsert key)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_vendor_lease_status on public.vendor_lease(status);
create index if not exists idx_vendor_lease_name   on public.vendor_lease using gin (name gin_trgm_ops);

create trigger trg_vendor_lease_updated_at
  before update on public.vendor_lease
  for each row execute function public.set_updated_at();

-- RLS: 로그인된 사용자 누구나 읽기 / 쓰기
alter table public.vendor_lease enable row level security;

create policy "vendor_lease: 인증 유저 조회"
  on public.vendor_lease for select
  using (auth.uid() is not null);

create policy "vendor_lease: 인증 유저 수정"
  on public.vendor_lease for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
