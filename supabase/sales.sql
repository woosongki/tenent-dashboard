-- ============================================================
-- SALES — 영·여성 브랜드 실적 (매출분석 탭)
-- 원천 HTML(영·여성 브랜드 실적 현황) 구조를 정규화.
--
-- 모든 탭(브랜드/지점/BCD/26년누적/당월누적/보고/온라인)은 아래
-- 3개 테이블에서 앱이 집계해서 만든다. ACC/CUM/SUMMARY/RANK는
-- 별도 저장 안 함 — sales_monthly + sales_store_meta 로 계산.
-- ============================================================

-- ── 1. 월별 매출 팩트 (long format) ──
-- RAW[].s_mo / g_mo 를 (브랜드×지점×월) 1행으로 펼친 것.
create table if not exists public.sales_monthly (
  id     bigint generated always as identity primary key,
  cat    text   not null,                 -- 복종: '여성' | '영캐'
  brand  text   not null,                 -- 브랜드명
  store  text   not null,                 -- 지점명
  ym     text   not null,                 -- 'YYYY-MM'
  sales  bigint not null default 0,        -- 매출(원)
  gp     bigint not null default 0,        -- 이익 GP(원)
  unique (cat, brand, store, ym)
);
create index if not exists idx_sales_monthly_lookup on public.sales_monthly (cat, brand, store);
create index if not exists idx_sales_monthly_ym on public.sales_monthly (ym);

-- ── 2. 브랜드×지점 메타 (면적·등급·카테고리) ──
-- ACC_DATA[].area/grade/bcat 에 해당. 평당지표(spd/gpd)는 area로 앱에서 계산.
create table if not exists public.sales_store_meta (
  id     bigint generated always as identity primary key,
  cat    text    not null,
  brand  text    not null,
  store  text    not null,
  area   numeric not null default 0,       -- 면적(평)
  grade  text    not null default '',      -- 'S'|'A'|'B'|'C'|'F'|'' (BCD 등급)
  bcat   text    not null default '',      -- '캐릭터'|'커리어'|'캐주얼'|'해외컨템'|'이너웨어'|'편집샵'|'온라인'|'시니어'|''
  unique (cat, brand, store)
);
create index if not exists idx_sales_meta_lookup on public.sales_store_meta (cat, brand, store);

-- ── 3. 온라인 월별 (채널별) ──
-- 8·9번 온라인 탭. 오프라인과 분리 (채널 차원 추가).
create table if not exists public.sales_online_monthly (
  id      bigint generated always as identity primary key,
  cat     text   not null,                 -- 복종
  brand   text   not null,
  channel text   not null,                 -- '자사몰'|'지마켓'|'11번가'|'쿠팡'|... 자유
  ym      text   not null,                 -- 'YYYY-MM'
  sales   bigint not null default 0,
  gp      bigint not null default 0,
  unique (cat, brand, channel, ym)
);
create index if not exists idx_sales_online_lookup on public.sales_online_monthly (cat, brand);
create index if not exists idx_sales_online_ym on public.sales_online_monthly (ym);

-- ── updated_at 불필요 (입력 위주 정적 데이터) ──

-- ── RLS: 인증 유저 조회 / 수정 (다른 테이블과 동일 정책) ──
alter table public.sales_monthly        enable row level security;
alter table public.sales_store_meta     enable row level security;
alter table public.sales_online_monthly enable row level security;

create policy "sales_monthly: 인증 조회"  on public.sales_monthly        for select using (auth.uid() is not null);
create policy "sales_monthly: 인증 수정"  on public.sales_monthly        for all    using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "sales_meta: 인증 조회"     on public.sales_store_meta     for select using (auth.uid() is not null);
create policy "sales_meta: 인증 수정"     on public.sales_store_meta     for all    using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "sales_online: 인증 조회"   on public.sales_online_monthly for select using (auth.uid() is not null);
create policy "sales_online: 인증 수정"   on public.sales_online_monthly for all    using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- 입력 가이드 (CSV → 테이블)
--   sales_monthly.csv      열: cat,brand,store,ym,sales,gp
--   sales_store_meta.csv   열: cat,brand,store,area,grade,bcat
--   sales_online_monthly.csv 열: cat,brand,channel,ym,sales,gp
-- Supabase 대시보드 → Table Editor → Import data from CSV
-- ============================================================
