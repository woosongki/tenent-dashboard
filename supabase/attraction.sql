-- ============================================================
-- ATTRACTION_STATUS — 입점계획(26년)
-- Notion 이랜드리테일 컨텐츠 유치 현황 → Supabase 단방향 싱크
--
-- 운영 DB에는 이미 이 테이블이 수동으로 만들어져 있지만 schema가
-- 리포에 없어, notion_url UNIQUE 제약이 누락된 채로 동작해 왔다.
-- 이 마이그레이션은:
--   1) 테이블이 없으면 생성
--   2) 기존 notion_url 중복을 정리(가장 오래된 1건만 유지)
--   3) notion_url에 partial UNIQUE INDEX 추가 (NULL은 허용)
-- 를 멱등하게 수행한다. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.attraction_status (
  id            uuid primary key default gen_random_uuid(),
  brand_name    text not null,                 -- 컨텐츠 브랜드 (title)
  branch        text,                          -- 지점 (select)
  floor         text,                          -- 층 (select)
  category      text,                          -- 카테고리 (select)
  size_pyeong   numeric,                       -- 규모(평) (number)
  manager       text,                          -- 담당자 (rich_text)
  is_completed  boolean not null default false,-- 완료여부 (checkbox)
  memo          text,                          -- 기타 (rich_text)
  notion_url    text,                          -- Notion 페이지 URL (upsert key)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 1) 기존 중복 정리 ─────────────────────────────────────────
-- notion_url이 같은 행이 2개 이상 있으면 created_at 가장 빠른 1건만 남김.
-- (manual로 추가된 NULL notion_url 행은 건드리지 않는다.)
with ranked as (
  select
    id,
    notion_url,
    row_number() over (
      partition by notion_url
      order by created_at asc, id asc
    ) as rn
  from public.attraction_status
  where notion_url is not null
)
delete from public.attraction_status a
using ranked r
where a.id = r.id
  and r.rn > 1;

-- ── 2) UNIQUE INDEX (partial — NULL 다중 허용) ────────────────
create unique index if not exists attraction_status_notion_url_uniq
  on public.attraction_status (notion_url)
  where notion_url is not null;

-- ── 3) updated_at 자동 갱신 트리거 ────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_attraction_status_updated_at'
  ) then
    create trigger trg_attraction_status_updated_at
      before update on public.attraction_status
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── 4) RLS — 로그인된 사용자 누구나 읽기/쓰기 ──────────────────
alter table public.attraction_status enable row level security;

drop policy if exists "attraction_status: 인증 유저 조회"  on public.attraction_status;
drop policy if exists "attraction_status: 인증 유저 수정"  on public.attraction_status;

create policy "attraction_status: 인증 유저 조회"
  on public.attraction_status for select
  using (auth.uid() is not null);

create policy "attraction_status: 인증 유저 수정"
  on public.attraction_status for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
