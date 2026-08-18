-- ============================================================
-- SALES OFFLINE MONTHLY HIST — 오프라인 매출을 (브랜드×지점×월) 단위로 이력 축적
--
-- 배경:
--   기존 sales_offline_cum(연 1행)과 sales_offline_month(마감월 1개만, 매달 swap 교체)
--   구조로는 "누적 안에서 월별로 나눠 보기 + 지난 연도 이력 보존"을 만족시킬 수 없음.
--   이 테이블은 5.특정(누적)_DB 파일의 월별 컬럼(1~7월…)을 그대로 (브랜드×지점×월) 로
--   풀어 저장한다. 매달 재업로드 시 파일에 담긴 연도만 delete → insert(원자적)로
--   갱신하고 그 외 과거 연도는 보존한다.
--
-- 단위:
--   area_raw = 평·일 (실면적 × 해당 월 일수)로 사전 곱셈해 적재.
--   sales_offline_cum(연 누적 평·일)과 동일 단위 → 집계 시 그대로 합.
--   store_cnt = 그 월의 지점 수(파일 값 그대로).
--
-- 적용: Supabase SQL Editor 에 이 파일 실행 (sales.sql 이후, 순서 무관). 멱등.
-- ============================================================

create table if not exists public.sales_offline_monthly_hist (
  id        bigint generated always as identity primary key,
  division  text not null,
  cat       text not null,
  brand     text not null,
  store     text not null,
  year      text not null,           -- 'YYYY' (연도 스위처·year-scoped delete용, ym에서 유도 가능하나 인덱스 편의)
  ym        text not null,           -- 'YYYY-MM'
  sales     bigint not null default 0,
  gp        bigint not null default 0,
  area_raw  bigint not null default 0,  -- 평·일 (실면적 × 해당월 일수)
  store_cnt bigint not null default 0,
  unique (division, cat, brand, store, ym)
);
create index if not exists idx_off_hist_year on public.sales_offline_monthly_hist (year);
create index if not exists idx_off_hist_ym   on public.sales_offline_monthly_hist (ym);
create index if not exists idx_off_hist_lookup on public.sales_offline_monthly_hist (division, cat, brand, store);

-- RLS: 인증 유저 조회. 쓰기는 service_role(서버 액션)만 가능 → 별도 write 정책 없음.
alter table public.sales_offline_monthly_hist enable row level security;
drop policy if exists "off_hist sel" on public.sales_offline_monthly_hist;
create policy "off_hist sel" on public.sales_offline_monthly_hist
  for select using (auth.uid() is not null);
