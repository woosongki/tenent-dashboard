-- ============================================================
-- GANA SaaS — Supabase Full Schema
-- Tables / Indexes / Views / Triggers / RLS
-- ============================================================

-- ──────────────────────────────────────────────
-- EXTENSIONS
-- ──────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- 텍스트 검색용


-- ============================================================
-- 1. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 1-1. profiles  (auth.users 와 1:1)
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 1-2. plans  (구독 플랜 마스터)
-- ------------------------------------------------------------
create table public.plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,          -- 'free' | 'pro' | 'enterprise'
  display_name    text not null,
  price_monthly   numeric(10,2) not null default 0,
  price_yearly    numeric(10,2) not null default 0,
  max_seats       int  not null default 5,       -- 조직 최대 멤버 수
  features        jsonb not null default '{}',   -- { "ai": true, "api": false, … }
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- 기본 플랜 삽입
insert into public.plans (name, display_name, price_monthly, price_yearly, max_seats, features) values
  ('free',       'Free',       0,     0,      3,   '{"ai":false,"api":false,"custom_domain":false}'),
  ('pro',        'Pro',        29,    290,    20,  '{"ai":true,"api":true,"custom_domain":false}'),
  ('enterprise', 'Enterprise', 99,    990,    999, '{"ai":true,"api":true,"custom_domain":true}');

-- ------------------------------------------------------------
-- 1-3. organizations  (테넌트)
-- ------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,              -- URL-safe 식별자
  logo_url    text,
  plan_id     uuid not null references public.plans(id),
  owner_id    uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 1-4. organization_members  (조직 ↔ 유저 N:M)
-- ------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'member');

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.member_role not null default 'member',
  joined_at       timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ------------------------------------------------------------
-- 1-5. invitations  (초대 링크)
-- ------------------------------------------------------------
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'cancelled');

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role            public.member_role not null default 'member',
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  status          public.invitation_status not null default 'pending',
  invited_by      uuid not null references auth.users(id),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 1-6. subscriptions  (조직별 구독)
-- ------------------------------------------------------------
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'unpaid'
);
create type public.billing_interval as enum ('monthly', 'yearly');

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  plan_id               uuid not null references public.plans(id),
  status                public.subscription_status not null default 'trialing',
  billing_interval      public.billing_interval not null default 'monthly',
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end  boolean not null default false,
  -- Stripe / 외부 결제 연동용
  stripe_subscription_id  text unique,
  stripe_customer_id       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id)   -- 조직당 구독 1개
);

-- ------------------------------------------------------------
-- 1-7. billing_history  (결제 내역)
-- ------------------------------------------------------------
create type public.payment_status as enum ('paid', 'failed', 'refunded', 'pending');

create table public.billing_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id         uuid not null references public.plans(id),
  amount          numeric(10,2) not null,
  currency        text not null default 'usd',
  status          public.payment_status not null default 'pending',
  invoice_url     text,
  stripe_invoice_id text unique,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

-- profiles
create index idx_profiles_email on public.profiles(email);

-- organizations
create index idx_organizations_owner   on public.organizations(owner_id);
create index idx_organizations_plan    on public.organizations(plan_id);
create index idx_organizations_slug    on public.organizations(slug);        -- 이미 unique이지만 명시

-- organization_members
create index idx_org_members_org  on public.organization_members(organization_id);
create index idx_org_members_user on public.organization_members(user_id);
create index idx_org_members_role on public.organization_members(role);

-- invitations
create index idx_invitations_org     on public.invitations(organization_id);
create index idx_invitations_email   on public.invitations(email);
create index idx_invitations_token   on public.invitations(token);
create index idx_invitations_status  on public.invitations(status);

-- subscriptions
create index idx_subscriptions_org    on public.subscriptions(organization_id);
create index idx_subscriptions_status on public.subscriptions(status);
create index idx_subscriptions_period on public.subscriptions(current_period_end);

-- billing_history
create index idx_billing_org    on public.billing_history(organization_id);
create index idx_billing_status on public.billing_history(status);
create index idx_billing_paid   on public.billing_history(paid_at);


-- ============================================================
-- 3. VIEWS
-- ============================================================

-- ------------------------------------------------------------
-- 3-1. member_details  —  멤버 + 프로필 + 조직 정보 조합
-- ------------------------------------------------------------
create or replace view public.member_details as
select
  om.id               as membership_id,
  om.organization_id,
  om.role,
  om.joined_at,
  o.name              as organization_name,
  o.slug              as organization_slug,
  p.id                as user_id,
  p.email,
  p.full_name,
  p.avatar_url
from public.organization_members om
join public.organizations o on o.id = om.organization_id
join public.profiles      p on p.id = om.user_id;

-- ------------------------------------------------------------
-- 3-2. active_subscriptions  —  현재 유효 구독 + 플랜 정보
-- ------------------------------------------------------------
create or replace view public.active_subscriptions as
select
  s.id               as subscription_id,
  s.organization_id,
  s.status,
  s.billing_interval,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  pl.name            as plan_name,
  pl.display_name    as plan_display_name,
  pl.max_seats,
  pl.features,
  case s.billing_interval
    when 'monthly' then pl.price_monthly
    when 'yearly'  then pl.price_yearly
  end                as current_price,
  o.name             as organization_name,
  o.slug             as organization_slug
from public.subscriptions s
join public.plans         pl on pl.id = s.plan_id
join public.organizations o  on o.id  = s.organization_id
where s.status in ('trialing', 'active');

-- ------------------------------------------------------------
-- 3-3. organization_seat_usage  —  조직별 좌석 사용 현황
-- ------------------------------------------------------------
create or replace view public.organization_seat_usage as
select
  o.id                                   as organization_id,
  o.name                                 as organization_name,
  o.slug,
  pl.max_seats,
  count(om.id)                           as used_seats,
  pl.max_seats - count(om.id)            as remaining_seats,
  round(count(om.id)::numeric / pl.max_seats * 100, 1) as usage_pct
from public.organizations o
join public.plans                pl on pl.id = o.plan_id
left join public.organization_members om on om.organization_id = o.id
group by o.id, o.name, o.slug, pl.max_seats;


-- ============================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- 4-1. updated_at 자동 갱신 함수
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4-2. 신규 유저 가입 시 profile 자동 생성
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 4-3. 조직 생성 시 owner를 organization_members에 자동 추가
-- ------------------------------------------------------------
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  -- Free 플랜 구독 자동 생성
  insert into public.subscriptions (organization_id, plan_id, status)
  select new.id, p.id, 'active'
  from public.plans p
  where p.name = 'free'
  limit 1;

  return new;
end;
$$;

create trigger trg_on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ------------------------------------------------------------
-- 4-4. 초대 수락 시 organization_members 자동 추가
-- ------------------------------------------------------------
create or replace function public.accept_invitation(p_token text, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv   public.invitations%rowtype;
  v_seats int;
  v_used  int;
begin
  -- 초대 조회
  select * into v_inv
  from public.invitations
  where token = p_token
    and status = 'pending'
    and expires_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invitation_invalid_or_expired');
  end if;

  -- 좌석 수 확인
  select pl.max_seats into v_seats
  from public.organizations o
  join public.plans pl on pl.id = o.plan_id
  where o.id = v_inv.organization_id;

  select count(*) into v_used
  from public.organization_members
  where organization_id = v_inv.organization_id;

  if v_used >= v_seats then
    return jsonb_build_object('ok', false, 'error', 'seat_limit_reached');
  end if;

  -- 멤버 추가
  insert into public.organization_members (organization_id, user_id, role)
  values (v_inv.organization_id, p_user_id, v_inv.role)
  on conflict (organization_id, user_id) do nothing;

  -- 초대 상태 업데이트
  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = v_inv.id;

  return jsonb_build_object('ok', true, 'organization_id', v_inv.organization_id);
end;
$$;

-- ------------------------------------------------------------
-- 4-5. 만료 초대 자동 처리 (pg_cron 없을 경우 수동 호출용)
-- ------------------------------------------------------------
create or replace function public.expire_invitations()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.invitations
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();
end;
$$;


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- ------------------------------------------------------------
-- Helper: 현재 유저가 조직의 멤버인지 확인
-- ------------------------------------------------------------
create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
  );
$$;

-- Helper: 현재 유저가 조직의 admin 이상인지 확인
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ── profiles ─────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles: 본인 조회"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: 같은 조직 멤버 조회"
  on public.profiles for select
  using (
    exists (
      select 1 from public.organization_members om1
      join public.organization_members om2 on om1.organization_id = om2.organization_id
      where om1.user_id = auth.uid()
        and om2.user_id = profiles.id
    )
  );

create policy "profiles: 본인 수정"
  on public.profiles for update
  using (id = auth.uid());

-- ── organizations ────────────────────────────
alter table public.organizations enable row level security;

create policy "organizations: 멤버만 조회"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "organizations: 인증된 유저 생성"
  on public.organizations for insert
  with check (auth.uid() = owner_id);

create policy "organizations: admin 이상 수정"
  on public.organizations for update
  using (public.is_org_admin(id));

create policy "organizations: owner만 삭제"
  on public.organizations for delete
  using (owner_id = auth.uid());

-- ── organization_members ─────────────────────
alter table public.organization_members enable row level security;

create policy "org_members: 같은 조직 멤버 조회"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

create policy "org_members: admin 이상 추가"
  on public.organization_members for insert
  with check (public.is_org_admin(organization_id));

create policy "org_members: admin 이상 역할 변경"
  on public.organization_members for update
  using (public.is_org_admin(organization_id));

create policy "org_members: admin 이상 제거 또는 본인 탈퇴"
  on public.organization_members for delete
  using (
    public.is_org_admin(organization_id)
    or user_id = auth.uid()
  );

-- ── invitations ──────────────────────────────
alter table public.invitations enable row level security;

create policy "invitations: 멤버 조회"
  on public.invitations for select
  using (public.is_org_member(organization_id));

create policy "invitations: admin 이상 생성"
  on public.invitations for insert
  with check (public.is_org_admin(organization_id));

create policy "invitations: admin 이상 취소"
  on public.invitations for update
  using (public.is_org_admin(organization_id));

-- ── subscriptions ────────────────────────────
alter table public.subscriptions enable row level security;

create policy "subscriptions: 멤버 조회"
  on public.subscriptions for select
  using (public.is_org_member(organization_id));

-- INSERT/UPDATE/DELETE는 service_role(백엔드)에서만 수행

-- ── billing_history ──────────────────────────
alter table public.billing_history enable row level security;

create policy "billing_history: admin 이상 조회"
  on public.billing_history for select
  using (public.is_org_admin(organization_id));

-- INSERT/UPDATE/DELETE는 service_role(백엔드)에서만 수행


-- ============================================================
-- 6. REALTIME (선택적 활성화)
-- ============================================================
-- Supabase 대시보드 > Database > Replication 에서 활성화하거나 아래 실행
-- alter publication supabase_realtime add table public.organization_members;
-- alter publication supabase_realtime add table public.invitations;
