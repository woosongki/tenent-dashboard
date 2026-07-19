-- ============================================================
-- SALES INGEST v2 — 원자적 교체 파이프라인 + 권한 강화 + 롤백
--
-- 배경(v1의 문제):
--   · 브라우저에서 real 테이블을 delete → 배치 insert 로 통째 교체했음.
--     중간 실패 시 테이블이 반쯤 빈 채로 남아 매출분석/AI 벤치마크가
--     잘못된 숫자를 노출(비원자적).
--   · RLS가 "authenticated면 for all" 이라 일반 member도 anon key로
--     매출 테이블을 직접 지우거나 쓸 수 있었음(권한 취약).
--
-- v2 설계:
--   1) 각 대상 테이블에 *_staging(스크래치) / *_backup(1단계 롤백) 테이블.
--   2) 클라이언트는 staging 에만 배치 insert → swap RPC 가 트랜잭션 1회로
--      backup 저장 → real 비우고 staging→real → staging 정리 → 이력 기록.
--      함수 본문 전체가 하나의 트랜잭션이라 real 은 원자적으로만 교체됨.
--   3) swap/clear/restore RPC 는 security definer + owner/admin 만 허용.
--   4) real 테이블의 광범위 쓰기 정책 제거 → 쓰기는 RPC(definer) 경유만.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일 전체 실행 (sales.sql 이후).
-- 멱등(idempotent): 여러 번 실행해도 안전.
-- ============================================================

-- ── 0. 이관 대상 테이블(클라이언트가 통째 교체하는 4종) ──
--    sales_monthly / sales_store_meta 는 대시보드 CSV(서비스롤)로 적재 → 대상 외.

-- ── 1. staging / backup 테이블 (id 없이 data 컬럼만; real 과 동일 스키마) ──
-- 오프라인은 area_raw/store_cnt(bigint) 컬럼도 함께 적재됨(sales.sql 은 구버전이라 누락).
create table if not exists public.sales_offline_month_staging (
  division text not null, cat text not null, brand text not null, store text not null,
  ym text not null, sales bigint not null default 0, gp bigint not null default 0,
  area_raw bigint not null default 0, store_cnt bigint not null default 0
);
create table if not exists public.sales_offline_month_backup (like public.sales_offline_month_staging including defaults);

create table if not exists public.sales_offline_cum_staging (
  division text not null, cat text not null, brand text not null, store text not null,
  year text not null, sales bigint not null default 0, gp bigint not null default 0,
  area_raw bigint not null default 0, store_cnt bigint not null default 0
);
create table if not exists public.sales_offline_cum_backup (like public.sales_offline_cum_staging including defaults);

create table if not exists public.sales_online_monthly_staging (
  division text not null, cat text not null, brand text not null, store text not null,
  channel text not null, ym text not null, sales bigint not null default 0
);
create table if not exists public.sales_online_monthly_backup (like public.sales_online_monthly_staging including defaults);

create table if not exists public.sales_online_cum_staging (
  division text not null, cat text not null, brand text not null, store text not null,
  channel text not null, year text not null, sales bigint not null default 0
);
create table if not exists public.sales_online_cum_backup (like public.sales_online_cum_staging including defaults);

-- ── 2. 적재 이력 로그 ──
create table if not exists public.sales_ingest_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_count  bigint not null default 0,
  action     text not null default 'swap',   -- 'swap' | 'restore'
  actor      uuid,                            -- auth.uid()
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_ingest_log_at on public.sales_ingest_log (created_at desc);

-- ── 3. 권한 헬퍼 ──
create or replace function public.is_sales_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

-- ── 4. staging 비우기 (배치 insert 전 초기화) ──
create or replace function public.clear_sales_staging(p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[] := array['sales_offline_month','sales_offline_cum','sales_online_monthly','sales_online_cum'];
begin
  if not public.is_sales_admin() then
    raise exception 'only owner/admin can modify sales data';
  end if;
  if not (p_table = any(v_allowed)) then
    raise exception 'table not allowed: %', p_table;
  end if;
  execute format('truncate public.%I', p_table || '_staging');
end;
$$;

-- ── 5. 원자적 교체: backup 저장 → real 교체 → staging 정리 → 이력 ──
create or replace function public.swap_sales_from_staging(p_table text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[] := array['sales_offline_month','sales_offline_cum','sales_online_monthly','sales_online_cum'];
  v_staging text := p_table || '_staging';
  v_backup  text := p_table || '_backup';
  v_cols    text;
  v_count   bigint;
begin
  if not public.is_sales_admin() then
    raise exception 'only owner/admin can replace sales data';
  end if;
  if not (p_table = any(v_allowed)) then
    raise exception 'table not allowed: %', p_table;
  end if;

  -- staging 의 컬럼 목록(=id 제외) — real/backup 에도 모두 존재하는 부분집합
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = v_staging;
  if v_cols is null then
    raise exception 'staging table not found: %', v_staging;
  end if;

  -- 1) 직전 데이터 백업(1단계 롤백)
  execute format('truncate public.%I', v_backup);
  execute format('insert into public.%I (%s) select %s from public.%I', v_backup, v_cols, v_cols, p_table);

  -- 2) 원자적 교체
  execute format('delete from public.%I', p_table);
  execute format('insert into public.%I (%s) select %s from public.%I', p_table, v_cols, v_cols, v_staging);
  get diagnostics v_count = row_count;

  -- 3) staging 정리
  execute format('truncate public.%I', v_staging);

  -- 4) 이력
  insert into public.sales_ingest_log (table_name, row_count, action, actor)
  values (p_table, v_count, 'swap', auth.uid());

  return v_count;
end;
$$;

-- ── 6. 롤백: 직전 backup 을 real 로 복원(1단계) ──
create or replace function public.restore_sales_backup(p_table text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[] := array['sales_offline_month','sales_offline_cum','sales_online_monthly','sales_online_cum'];
  v_backup  text := p_table || '_backup';
  v_cols    text;
  v_count   bigint;
begin
  if not public.is_sales_admin() then
    raise exception 'only owner/admin can restore sales data';
  end if;
  if not (p_table = any(v_allowed)) then
    raise exception 'table not allowed: %', p_table;
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = v_backup;
  if v_cols is null then
    raise exception 'backup table not found: %', v_backup;
  end if;

  execute format('delete from public.%I', p_table);
  execute format('insert into public.%I (%s) select %s from public.%I', p_table, v_cols, v_cols, v_backup);
  get diagnostics v_count = row_count;

  insert into public.sales_ingest_log (table_name, row_count, action, actor)
  values (p_table, v_count, 'restore', auth.uid());

  return v_count;
end;
$$;

-- ── 7. RLS ──
-- staging: owner/admin 만 rw (클라이언트가 anon key 로 배치 insert 하므로 정책 필요)
-- backup:  RLS on, 정책 없음 → 클라이언트 접근 차단(정의자 함수만 접근)
do $$
declare t text;
begin
  foreach t in array array[
    'sales_offline_month','sales_offline_cum','sales_online_monthly','sales_online_cum'
  ] loop
    execute format('alter table public.%I enable row level security', t || '_staging');
    execute format('alter table public.%I enable row level security', t || '_backup');
    execute format('drop policy if exists "staging rw" on public.%I', t || '_staging');
    execute format(
      'create policy "staging rw" on public.%I for all using (public.is_sales_admin()) with check (public.is_sales_admin())',
      t || '_staging'
    );
  end loop;
end $$;

alter table public.sales_ingest_log enable row level security;
drop policy if exists "ingest log sel" on public.sales_ingest_log;
create policy "ingest log sel" on public.sales_ingest_log for select using (public.is_sales_admin());

-- ── 8. real 테이블의 광범위 쓰기 정책 제거 (읽기 select 정책은 유지) ──
--    쓰기는 이제 swap/restore RPC(security definer) 경유만 → 일반 유저 직접 쓰기 차단.
drop policy if exists "offcum all"                    on public.sales_offline_cum;
drop policy if exists "offmon all"                    on public.sales_offline_month;
drop policy if exists "sales_online_cum: 인증 수정"    on public.sales_online_cum;
drop policy if exists "sales_online: 인증 수정"        on public.sales_online_monthly;
drop policy if exists "sales_monthly: 인증 수정"       on public.sales_monthly;
drop policy if exists "sales_meta: 인증 수정"          on public.sales_store_meta;

-- ── 9. 실행 권한 ──
grant execute on function public.is_sales_admin()               to authenticated;
grant execute on function public.clear_sales_staging(text)      to authenticated;
grant execute on function public.swap_sales_from_staging(text)  to authenticated;
grant execute on function public.restore_sales_backup(text)     to authenticated;
