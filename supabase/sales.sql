-- ============================================================
-- SALES — 전 부문 브랜드 실적 (매출분석 탭)
-- 영·여성뿐 아니라 패션 / F&B / 기타 전 부문 수용.
--
-- 분류 2단계:
--   division (대분류/부문): '패션' | 'F&B' | '기타'  (확장 가능)
--   cat      (복종/세부):  '여성' | '영캐' | '외식' | '카페' | ... 자유 텍스트
--
-- 모든 탭(브랜드/지점/BCD/누적/온라인)은 아래 3테이블에서 앱이 집계.
-- ACC/CUM/SUMMARY/RANK는 저장 안 함 — monthly + meta 로 계산.
-- ============================================================

-- ── 1. 월별 매출 팩트 (long format) ──
create table if not exists public.sales_monthly (
  id        bigint generated always as identity primary key,
  division  text   not null,                -- 대분류: '패션' | 'F&B' | '기타'
  cat       text   not null,                -- 복종/세부: '여성' | '영캐' | '외식' | ... 자유
  brand     text   not null,
  store     text   not null,
  ym        text   not null,                -- 'YYYY-MM'
  sales     bigint not null default 0,       -- 매출(원)
  gp        bigint not null default 0,       -- 이익 GP(원)
  unique (division, cat, brand, store, ym)
);
create index if not exists idx_sales_monthly_lookup on public.sales_monthly (division, cat, brand, store);
create index if not exists idx_sales_monthly_div on public.sales_monthly (division);
create index if not exists idx_sales_monthly_ym  on public.sales_monthly (ym);

-- ── 2. 브랜드×지점 메타 (면적·등급·카테고리) ──
create table if not exists public.sales_store_meta (
  id        bigint generated always as identity primary key,
  division  text    not null,
  cat       text    not null,
  brand     text    not null,
  store     text    not null,
  area      numeric not null default 0,      -- 면적(평)
  grade     text    not null default '',     -- 'S'|'A'|'B'|'C'|'F'|'' (BCD 등급)
  bcat      text    not null default '',     -- 브랜드 세부 카테고리 (부문별 상이, 자유 텍스트)
  unique (division, cat, brand, store)
);
create index if not exists idx_sales_meta_lookup on public.sales_store_meta (division, cat, brand, store);

-- ── 3. 온라인 월별 (지점×브랜드×채널) ──
-- ERP 매출상세분석 익스포트 기준. 온라인은 매출만 관리 (GP 없음).
create table if not exists public.sales_online_monthly (
  id        bigint generated always as identity primary key,
  division  text   not null,
  cat       text   not null,                -- 복종명 (캐쥬얼/스포츠/여성 ...)
  brand     text   not null,
  store     text   not null,                -- 지점명 (온라인 귀속 지점)
  channel   text   not null,                -- '쿠팡'|'11번가'|'네이버-스토어팜'|... 채널명
  ym        text   not null,                -- 'YYYY-MM'
  sales     bigint not null default 0,       -- 채널별 매출(원), 이익은 미관리
  unique (division, cat, brand, store, channel, ym)
);
create index if not exists idx_sales_online_lookup on public.sales_online_monthly (division, cat, brand, store);
create index if not exists idx_sales_online_ym on public.sales_online_monthly (ym);

-- ── 4. 온라인 누적 (연 누적, 지점×브랜드×채널) ──
-- 8번 온라인(전체) 탭. 연초~기준월 누적이라 월 분해 불가 → 연(year) 단위 저장.
create table if not exists public.sales_online_cum (
  id        bigint generated always as identity primary key,
  division  text   not null,
  cat       text   not null,
  brand     text   not null,
  store     text   not null,
  channel   text   not null,
  year      text   not null,                -- 'YYYY' (예: '2026' = 26년 누적)
  sales     bigint not null default 0,
  unique (division, cat, brand, store, channel, year)
);
create index if not exists idx_sales_online_cum_lookup on public.sales_online_cum (division, cat, brand, store);
create index if not exists idx_sales_online_cum_year on public.sales_online_cum (year);

-- ── 5. 오프라인 누적 (5번, 연 단위, 매출+이익) ──
-- through_ym: 누적 마감월('YYYY-MM'). 당월 테이블(sales_offline_month)의 최신 ym과 별개.
-- 예: 6월 마감 누적 + 7월 당월이 동시에 존재해도, cumMonths 계산이 through_ym를 우선 참조하므로
--   누적을 6개월로 정확히 나눔. 없으면(legacy) 호출부가 monthYm으로 폴백.
create table if not exists public.sales_offline_cum (
  id         bigint generated always as identity primary key,
  division   text not null, cat text not null, brand text not null, store text not null,
  year       text not null,
  sales      bigint not null default 0,
  gp         bigint not null default 0,
  through_ym text,
  unique (division, cat, brand, store, year)
);
alter table public.sales_offline_cum add column if not exists through_ym text;
create index if not exists idx_offcum_lookup on public.sales_offline_cum (division, cat, brand, store);
create index if not exists idx_offcum_year on public.sales_offline_cum (year);
-- 백필 가이드: 기존 행은 through_ym 이 null. 누적 파일을 재업로드하면 자동 채워짐.
-- 즉시 픽스가 필요하면 예: update public.sales_offline_cum set through_ym = '2026-06' where year = '2026';
--                        update public.sales_offline_cum set through_ym = '2025-06' where year = '2025';

-- ── 6. 오프라인 당월 (6번, 월 단위, 매출+이익) ──
-- days: 파일 "N일누적" 파싱값. 예: "6일누적" → 6. 없으면 daysInMonth(ym) 캘린더 말일 fallback.
create table if not exists public.sales_offline_month (
  id        bigint generated always as identity primary key,
  division  text not null, cat text not null, brand text not null, store text not null,
  ym        text not null,
  sales     bigint not null default 0,
  gp        bigint not null default 0,
  days      smallint,
  unique (division, cat, brand, store, ym)
);
alter table public.sales_offline_month add column if not exists days smallint;
create index if not exists idx_offmon_lookup on public.sales_offline_month (division, cat, brand, store);
create index if not exists idx_offmon_ym on public.sales_offline_month (ym);

-- ── RLS: 인증 유저 조회 / 수정 ──
alter table public.sales_monthly        enable row level security;
alter table public.sales_offline_cum    enable row level security;
alter table public.sales_offline_month  enable row level security;

create policy "offcum sel" on public.sales_offline_cum for select using (auth.uid() is not null);
create policy "offcum all" on public.sales_offline_cum for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "offmon sel" on public.sales_offline_month for select using (auth.uid() is not null);
create policy "offmon all" on public.sales_offline_month for all using (auth.uid() is not null) with check (auth.uid() is not null);
alter table public.sales_store_meta     enable row level security;
alter table public.sales_online_monthly enable row level security;
alter table public.sales_online_cum     enable row level security;

create policy "sales_online_cum: 인증 조회" on public.sales_online_cum for select using (auth.uid() is not null);
create policy "sales_online_cum: 인증 수정" on public.sales_online_cum for all    using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "sales_monthly: 인증 조회"  on public.sales_monthly        for select using (auth.uid() is not null);
create policy "sales_monthly: 인증 수정"  on public.sales_monthly        for all    using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "sales_meta: 인증 조회"     on public.sales_store_meta     for select using (auth.uid() is not null);
create policy "sales_meta: 인증 수정"     on public.sales_store_meta     for all    using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "sales_online: 인증 조회"   on public.sales_online_monthly for select using (auth.uid() is not null);
create policy "sales_online: 인증 수정"   on public.sales_online_monthly for all    using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- 입력 가이드 (CSV → 테이블)
--   sales_monthly.csv        열: division,cat,brand,store,ym,sales,gp
--   sales_store_meta.csv     열: division,cat,brand,store,area,grade,bcat
--   sales_online_monthly.csv 열: division,cat,brand,store,channel,ym,sales
-- Supabase 대시보드 → Table Editor → Import data from CSV
--
-- division 예시: 패션 / F&B / 기타
-- cat 예시:      패션→ 여성·영캐·남성·캐주얼·아동 / F&B→ 외식·카페·디저트 / 기타→ 리빙·잡화·서비스
-- ============================================================
