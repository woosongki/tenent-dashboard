-- ============================================================
-- LIVING POPUP v2 — 공간 DB(층/장소/평수) + 일매출(자동 실적)
-- 여러 번 실행해도 안전(멱등).
-- ============================================================

-- ── 1) 공간 카탈로그 — 지점별 팝업 가능 자리 (층·장소·평수) ──
-- 나중에 일괄 입력/갱신. 제안 카드·가용 히트맵에서 참조.
create table if not exists public.living_space (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store           text not null,          -- 지점
  floor           text,                   -- 층 (예: 1F, B1)
  place           text,                   -- 장소 (예: 행사장, 에스컬레이터 앞)
  area_pyeong     numeric,                -- 평수
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_living_space_org   on public.living_space(organization_id, store);

-- ── 2) 일매출 — 팝업별 날짜별 매출 (합계가 자동 실적) ──
create table if not exists public.living_popup_daily (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  popup_id        uuid not null references public.living_popup(id) on delete cascade,
  date            date not null,
  sales           numeric not null default 0,   -- 원 단위 (앱에서 백만 변환 표시)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (popup_id, date)
);
create index if not exists idx_living_daily_popup on public.living_popup_daily(popup_id);
create index if not exists idx_living_daily_org   on public.living_popup_daily(organization_id);

-- ── updated_at 트리거 ──
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_living_space_updated_at') then
    create trigger trg_living_space_updated_at before update on public.living_space
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_living_daily_updated_at') then
    create trigger trg_living_daily_updated_at before update on public.living_popup_daily
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── RLS — 멤버 조회 / admin 편집 ──
alter table public.living_space       enable row level security;
alter table public.living_popup_daily enable row level security;

drop policy if exists "living_space: 멤버 조회"  on public.living_space;
drop policy if exists "living_space: admin 편집" on public.living_space;
create policy "living_space: 멤버 조회"  on public.living_space for select using (public.is_org_member(organization_id));
create policy "living_space: admin 편집" on public.living_space for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

drop policy if exists "living_daily: 멤버 조회"  on public.living_popup_daily;
drop policy if exists "living_daily: admin 편집" on public.living_popup_daily;
create policy "living_daily: 멤버 조회"  on public.living_popup_daily for select using (public.is_org_member(organization_id));
create policy "living_daily: admin 편집" on public.living_popup_daily for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
