-- ============================================================
-- DRILLDOWN — 채널 · 브랜드별 성과 분석
-- ============================================================

create type public.channel_type as enum (
  'organic_search',
  'paid_search',
  'paid_social',
  'organic_social',
  'direct',
  'referral',
  'email',
  'other'
);

-- ── channels ─────────────────────────────────────────────────
create table public.channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  type            public.channel_type not null default 'other',
  color           text not null default '#6366f1',   -- HEX 색상
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create index idx_channels_org on public.channels(organization_id);

create trigger trg_channels_updated_at
  before update on public.channels
  for each row execute function public.set_updated_at();

-- ── brands ───────────────────────────────────────────────────
create table public.brands (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  color           text not null default '#8b5cf6',
  logo_url        text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create index idx_brands_org on public.brands(organization_id);

create trigger trg_brands_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

-- ── channel_stats ─────────────────────────────────────────────
-- 채널 × 브랜드 × 날짜의 일별 성과 지표
create table public.channel_stats (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id      uuid not null references public.channels(id) on delete cascade,
  brand_id        uuid not null references public.brands(id) on delete cascade,
  stat_date       date not null,
  sessions        int  not null default 0 check (sessions >= 0),
  conversions     int  not null default 0 check (conversions >= 0),
  revenue         numeric(14,2) not null default 0 check (revenue >= 0),
  ad_spend        numeric(14,2) not null default 0 check (ad_spend >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (channel_id, brand_id, stat_date)
);

create index idx_stats_org_date    on public.channel_stats(organization_id, stat_date desc);
create index idx_stats_channel     on public.channel_stats(channel_id, stat_date desc);
create index idx_stats_brand       on public.channel_stats(brand_id, stat_date desc);
create index idx_stats_channel_brand on public.channel_stats(channel_id, brand_id, stat_date desc);

create trigger trg_channel_stats_updated_at
  before update on public.channel_stats
  for each row execute function public.set_updated_at();

-- ── View: channel_summary ─────────────────────────────────────
-- 채널별 집계 + 파생 지표
create or replace view public.channel_summary as
select
  cs.organization_id,
  c.id                              as channel_id,
  c.name                            as channel_name,
  c.type                            as channel_type,
  c.color,
  sum(cs.sessions)                  as total_sessions,
  sum(cs.conversions)               as total_conversions,
  sum(cs.revenue)                   as total_revenue,
  sum(cs.ad_spend)                  as total_ad_spend,
  case when sum(cs.sessions) > 0
       then round(sum(cs.conversions)::numeric / sum(cs.sessions) * 100, 2)
       else 0 end                   as conversion_rate,
  case when sum(cs.ad_spend) > 0
       then round(sum(cs.revenue) / sum(cs.ad_spend), 2)
       else null end                as roas,
  case when sum(cs.conversions) > 0
       then round(sum(cs.ad_spend) / sum(cs.conversions), 2)
       else null end                as cpa,
  min(cs.stat_date)                 as first_stat_date,
  max(cs.stat_date)                 as last_stat_date
from public.channel_stats cs
join public.channels c on c.id = cs.channel_id
group by cs.organization_id, c.id, c.name, c.type, c.color;

-- ── View: brand_channel_summary ──────────────────────────────
-- 채널 내 브랜드별 집계
create or replace view public.brand_channel_summary as
select
  cs.organization_id,
  cs.channel_id,
  b.id                              as brand_id,
  b.name                            as brand_name,
  b.color                           as brand_color,
  sum(cs.sessions)                  as total_sessions,
  sum(cs.conversions)               as total_conversions,
  sum(cs.revenue)                   as total_revenue,
  sum(cs.ad_spend)                  as total_ad_spend,
  case when sum(cs.sessions) > 0
       then round(sum(cs.conversions)::numeric / sum(cs.sessions) * 100, 2)
       else 0 end                   as conversion_rate,
  case when sum(cs.ad_spend) > 0
       then round(sum(cs.revenue) / sum(cs.ad_spend), 2)
       else null end                as roas,
  case when sum(cs.conversions) > 0
       then round(sum(cs.ad_spend) / sum(cs.conversions), 2)
       else null end                as cpa,
  min(cs.stat_date)                 as first_stat_date,
  max(cs.stat_date)                 as last_stat_date
from public.channel_stats cs
join public.brands b on b.id = cs.brand_id
group by cs.organization_id, cs.channel_id, b.id, b.name, b.color;

-- ── RLS ──────────────────────────────────────────────────────
alter table public.channels     enable row level security;
alter table public.brands       enable row level security;
alter table public.channel_stats enable row level security;

-- channels
create policy "channels: 멤버 조회"   on public.channels for select using (public.is_org_member(organization_id));
create policy "channels: admin 생성"  on public.channels for insert with check (public.is_org_admin(organization_id));
create policy "channels: admin 수정"  on public.channels for update using (public.is_org_admin(organization_id));
create policy "channels: admin 삭제"  on public.channels for delete using (public.is_org_admin(organization_id));

-- brands
create policy "brands: 멤버 조회"     on public.brands for select using (public.is_org_member(organization_id));
create policy "brands: admin 생성"    on public.brands for insert with check (public.is_org_admin(organization_id));
create policy "brands: admin 수정"    on public.brands for update using (public.is_org_admin(organization_id));
create policy "brands: admin 삭제"    on public.brands for delete using (public.is_org_admin(organization_id));

-- channel_stats
create policy "stats: 멤버 조회"      on public.channel_stats for select using (public.is_org_member(organization_id));
create policy "stats: admin 생성"     on public.channel_stats for insert with check (public.is_org_admin(organization_id));
create policy "stats: admin 수정"     on public.channel_stats for update using (public.is_org_admin(organization_id));
create policy "stats: admin 삭제"     on public.channel_stats for delete using (public.is_org_admin(organization_id));
