-- ============================================================
-- GOALS — 목표치 관리
-- ============================================================

create type public.goal_category as enum (
  'revenue',    -- 매출
  'growth',     -- 성장
  'retention',  -- 유지
  'engagement', -- 참여
  'cost',       -- 비용
  'custom'      -- 사용자 정의
);

create type public.goal_period as enum (
  'monthly', 'quarterly', 'yearly'
);

create type public.goal_status as enum (
  'on_track',   -- 정상 궤도
  'at_risk',    -- 위험
  'behind',     -- 지연
  'completed',  -- 달성
  'cancelled'   -- 취소
);

create table public.goals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  title            text not null,
  description      text,
  category         public.goal_category not null default 'custom',
  target_value     numeric(15,2) not null,
  current_value    numeric(15,2) not null default 0,
  unit             text not null default '',        -- '%', '명', '$', '건' 등
  period           public.goal_period not null default 'monthly',
  start_date       date not null,
  end_date         date not null,
  status           public.goal_status not null default 'on_track',
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint chk_dates check (end_date >= start_date),
  constraint chk_target check (target_value > 0)
);

-- 인덱스
create index idx_goals_org      on public.goals(organization_id);
create index idx_goals_category on public.goals(category);
create index idx_goals_status   on public.goals(status);
create index idx_goals_period   on public.goals(period, start_date, end_date);

-- updated_at 트리거
create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.goals enable row level security;

create policy "goals: 멤버 조회"
  on public.goals for select
  using (public.is_org_member(organization_id));

create policy "goals: 멤버 생성"
  on public.goals for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

create policy "goals: 멤버 수정"
  on public.goals for update
  using (public.is_org_member(organization_id));

create policy "goals: admin 이상 삭제"
  on public.goals for delete
  using (public.is_org_admin(organization_id));

-- ── 달성률 자동 상태 업데이트 함수 ──────────────────────────
create or replace function public.sync_goal_status()
returns trigger language plpgsql as $$
declare
  pct numeric;
  days_total int;
  days_elapsed int;
  time_pct numeric;
begin
  if new.target_value = 0 then return new; end if;

  pct          := (new.current_value / new.target_value) * 100;
  days_total   := (new.end_date - new.start_date);
  days_elapsed := (current_date - new.start_date);
  time_pct     := case when days_total = 0 then 100
                       else least(100, (days_elapsed::numeric / days_total) * 100) end;

  -- 이미 완료/취소된 목표는 건드리지 않음
  if new.status in ('completed', 'cancelled') then return new; end if;

  new.status :=
    case
      when pct >= 100              then 'completed'
      when pct >= (time_pct * 0.9) then 'on_track'
      when pct >= (time_pct * 0.7) then 'at_risk'
      else                              'behind'
    end;

  return new;
end;
$$;

create trigger trg_goals_sync_status
  before insert or update of current_value, target_value on public.goals
  for each row execute function public.sync_goal_status();
