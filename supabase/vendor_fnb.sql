-- ============================================================
-- VENDOR FNB — 업체리스트(F&B) · 컨텐츠풀 F&B 탭
-- Notion 업체리스트(F&B) DB → Supabase 단방향 싱크
--
-- 운영 DB에는 이 테이블이 수동으로 만들어져 있었으나 schema가
-- 리포에 없어 notion_url UNIQUE 제약이 누락된 채 동작해 왔다.
-- → 노션 재싱크 시 같은 페이지가 또 INSERT되어 중복이 누적될 수 있었음.
--
-- 이 마이그레이션은 멱등하게:
--   1) 테이블이 없으면 생성
--   2) 기존 notion_url 중복 정리 (가장 오래된 1건만 유지)
--   3) notion_url에 partial UNIQUE INDEX 추가 (NULL은 다중 허용)
-- 를 수행한다. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.vendor_fnb (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                         -- 업체명 (title)
  types       text[] not null default '{}',          -- 유형 (multi_select)
  score       text,                                  -- 점수 (select)
  is_checked  boolean not null default false,        -- 체크박스
  status      text,                                  -- 팝업중 (status/select)
  link        text,                                  -- 링크 (url)
  contact     text,                                  -- 연락처 (phone_number)
  keyman      text,                                  -- 키맨 (rich_text)
  memo        text,                                  -- 기타 (rich_text)
  notion_url  text,                                  -- Notion 페이지 URL (upsert key)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 1) 기존 중복 정리 ─────────────────────────────────────────
-- notion_url이 같은 행이 2개 이상이면 created_at 가장 빠른 1건만 남김.
-- (manual로 추가된 NULL notion_url 행은 건드리지 않는다.)
with ranked as (
  select
    id,
    notion_url,
    row_number() over (
      partition by notion_url
      order by created_at asc, id asc
    ) as rn
  from public.vendor_fnb
  where notion_url is not null
)
delete from public.vendor_fnb a
using ranked r
where a.id = r.id
  and r.rn > 1;

-- ── 2) UNIQUE INDEX (partial — NULL 다중 허용) ────────────────
-- 이후 동일 notion_url INSERT는 DB가 직접 거부 → 중복 원천 차단.
create unique index if not exists vendor_fnb_notion_url_uniq
  on public.vendor_fnb (notion_url)
  where notion_url is not null;

-- ── 3) updated_at 자동 갱신 트리거 ────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_vendor_fnb_updated_at'
  ) then
    create trigger trg_vendor_fnb_updated_at
      before update on public.vendor_fnb
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── 4) RLS — 로그인된 사용자 누구나 읽기/쓰기 ──────────────────
alter table public.vendor_fnb enable row level security;

drop policy if exists "vendor_fnb: 인증 유저 조회" on public.vendor_fnb;
drop policy if exists "vendor_fnb: 인증 유저 수정" on public.vendor_fnb;

create policy "vendor_fnb: 인증 유저 조회"
  on public.vendor_fnb for select
  using (auth.uid() is not null);

create policy "vendor_fnb: 인증 유저 수정"
  on public.vendor_fnb for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
