-- ============================================================
-- LIVING POPUP — 리빙 주제전 (브랜드 × 지점 × 주차 팝업 운영)
-- 구글시트(연간 와이드 그리드)를 대체하는 앱 내 편집 데이터.
-- 1행 = 1팝업 = 1벤더(운영사). 매출은 백만원, 실행분만 입력.
-- 계획/진행/실행 상태는 저장하지 않고 날짜로 앱에서 계산.
-- 여러 번 실행해도 안전(멱등).
-- ============================================================

create table if not exists public.living_popup (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year            int  not null default 2026,
  brand           text not null,                 -- 브랜드 (락앤락 …)
  store           text not null,                 -- 지점 (광명 …)
  start_date      date not null,                 -- 시작일
  end_date        date not null,                 -- 종료일
  channel         text,                          -- 리테일(MDM) | 킴스(PDM)
  popup_type      text,                          -- 팝업 | 단기
  promo           text,                          -- 행사 (주년감사제 …)
  vendor          text,                          -- 운영사(벤더) — 건마다 다름
  sales           numeric,                       -- 실적 매출(백만), 실행분만
  note            text,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_living_popup_org      on public.living_popup(organization_id, year);
create index if not exists idx_living_popup_brand    on public.living_popup(organization_id, brand);
create index if not exists idx_living_popup_store    on public.living_popup(organization_id, store);
create index if not exists idx_living_popup_date     on public.living_popup(organization_id, start_date);

-- ── updated_at 자동 갱신 트리거 ──────────────────────────────
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_living_popup_updated_at') then
    create trigger trg_living_popup_updated_at
      before update on public.living_popup
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── RLS — 조직 멤버 조회 / admin 이상 편집 ───────────────────
alter table public.living_popup enable row level security;

drop policy if exists "living_popup: 멤버 조회"  on public.living_popup;
drop policy if exists "living_popup: admin 생성" on public.living_popup;
drop policy if exists "living_popup: admin 수정" on public.living_popup;
drop policy if exists "living_popup: admin 삭제" on public.living_popup;

create policy "living_popup: 멤버 조회"  on public.living_popup for select using (public.is_org_member(organization_id));
create policy "living_popup: admin 생성" on public.living_popup for insert with check (public.is_org_admin(organization_id));
create policy "living_popup: admin 수정" on public.living_popup for update using (public.is_org_admin(organization_id));
create policy "living_popup: admin 삭제" on public.living_popup for delete using (public.is_org_admin(organization_id));
