-- ============================================================
-- TENANT_CONTRACTS — 입점업체 계약 마스터
--
-- ERP xlsx 스냅샷을 로컬에서 tenant-contracts-master-*.tsv 로 저장한 뒤
-- `npm run upload:contracts` 로 이 테이블에 통째로 갈아 넣는다.
-- 로컬 dev 서버와 Vercel 프로덕션 모두 이 테이블을 통해 계약 데이터를 조회.
--
-- 갱신 전략:
--   업로드 스크립트가 DELETE all → INSERT all 로 전체를 교체 (ERP = 절대 진리).
--   앱에서는 조회 전용 — RLS 로 SELECT 만 허용, write 는 service_role 만.
--
-- 멱등: 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.tenant_contracts (
  id                    uuid primary key default gen_random_uuid(),
  plant_code            text not null,               -- 4자리 (지점 코드)
  store_name            text not null,               -- 지점명
  contract_type         text not null,               -- 임대갑/임대을/판매분특정 (단기 포함)
  floor                 text,
  purchase_group        text,
  purchase_code         text,
  purchase_name         text,
  brand                 text not null,               -- 브랜드명 (검색 키)
  representative        text,
  first_contract_date   date,
  contract_start_date   date,
  contract_end_date     date,                        -- 만료 알람의 축
  renewal_status        text,                        -- 자동연장·재계약·N개월 등
  business_id           text,                        -- 10자리 사업자번호
  contract_number       text,                        -- 14자리 계약번호
  md                    text,
  store_manager         text,
  contact_person        text,
  phone                 text,
  email                 text,
  source                text,                        -- 원본 TSV 파일명
  imported_at           timestamptz not null default now()
);

-- 조회 인덱스
create index if not exists tenant_contracts_end_date_idx     on public.tenant_contracts(contract_end_date);
create index if not exists tenant_contracts_brand_idx        on public.tenant_contracts(brand);
create index if not exists tenant_contracts_business_id_idx  on public.tenant_contracts(business_id);
create index if not exists tenant_contracts_store_idx        on public.tenant_contracts(store_name);

-- RLS: 인증 유저 SELECT 만 허용.
-- write 정책은 정의하지 않아서 사용자 세션(anon 쿠키)으로는 INSERT/UPDATE/DELETE 불가.
-- 업로드 스크립트는 service_role key 로 접속 → RLS 우회.
alter table public.tenant_contracts enable row level security;

drop policy if exists "tenant_contracts: 인증 유저 조회" on public.tenant_contracts;

create policy "tenant_contracts: 인증 유저 조회"
  on public.tenant_contracts for select
  using (auth.uid() is not null);
