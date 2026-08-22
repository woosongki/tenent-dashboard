-- ============================================================================
-- BCD (Brand Concept Degree) 스키마
-- 대상: 이랜드리테일 라이프스타일부문 GANA 프로젝트 (gana-phi)
-- 참조: BCD_브랜드컨셉등급제_PRD_v1.0
--
-- 적용 순서:
--   1. 이 파일을 Supabase SQL Editor에서 실행 (기존 gana 테이블과 이름 충돌 없음,
--      전부 bcd_ 접두사 사용)
--   2. 002_bcd_seed.sql 실행 (초기 ruleset + 벤치마크 10개점 목록)
--   3. lib/bcd/score.ts 배치
--   4. app/api/bcd/* 라우트 배치
--
-- 설계 원칙 (PRD 03절 · 10절):
--   - 원값과 점수는 분리 저장 (bcd_metric_values = 원값, bcd_evaluations = 점수)
--   - 지표는 컬럼이 아니라 행 (bcd_metric_values.metric_code)
--   - 기준·목록 버전을 평가에 박제 (ruleset_version, list_versions)
--   - 채점 함수는 서버 한 곳만 (lib/bcd/score.ts) — 이 스키마는 그 함수의 입출력을 담는 그릇
--
-- 테이블 생성 순서는 외래키 의존성을 따름:
--   bcd_snapshot_runs → bcd_lists → bcd_brands → bcd_rulesets
--   → bcd_metric_values / bcd_store_snapshots / bcd_search_volume
--   → bcd_evaluations → bcd_flags
-- ============================================================================

-- ── 1. 수집 회차 메타 (다른 테이블이 참조하므로 최상단) ──────────────────
create table if not exists bcd_snapshot_runs (
  id            uuid primary key default gen_random_uuid(),
  run_type      text not null,                             -- 'kakao_store' | 'naver_search'
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running',           -- running | completed | failed | review
  brands_total  int,
  brands_ok     int,
  brands_review int,                                        -- 이상치 게이트 걸린 건수
  triggered_by  text,                                        -- 'cron' | 'manual:{user}'
  note          text
);

-- ── 2. 목록 3종 통합 (벤치마크·핫플·채널) ─────────────────────────────────
create table if not exists bcd_lists (
  id             uuid primary key default gen_random_uuid(),
  list_type      text not null,                             -- 'hotspot' | 'benchmark' | 'channel'
  version        text not null,
  name           text not null,
  match_strings  text[] default '{}',                        -- 표기 변형 (지도 자동매칭용)
  dong_codes     text[] default '{}',                          -- hotspot 전용
  is_full_survey boolean default false,                        -- benchmark 전용: 전수조사 완료 여부
  category_scope text[],                                       -- channel 전용: 적용 카테고리
  meta           jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_bcd_lists_type_version on bcd_lists(list_type, version);

comment on table bcd_lists is
  '벤치마크 점포·핫플 상권·온라인 채널 3종 통합. list_type으로 구분. 버전 관리 필수(PRD 07.4절)';
comment on column bcd_lists.is_full_survey is
  'benchmark 전용: 전수조사 완료 점포만 true. false인 점포는 C1 분모에서 제외(PRD 07.1절)';

-- 벤치마크 점포 전용 뷰(가독성) — C1 계산의 분모가 되는 점포 수를 바로 셀 수 있게
create or replace view bcd_benchmark_stores as
  select id, name, match_strings, is_full_survey, version
  from bcd_lists where list_type = 'benchmark';

-- ── 3. 브랜드 마스터 ──────────────────────────────────────────────────────
create table if not exists bcd_brands (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  search_keywords   text[] not null default '{}',           -- 카카오맵·검색량 조회에 공통 사용
  category_major    text not null,                            -- 대분류 (8종)
  category_minor    text not null,                            -- 중분류 (28종, PRD 04.1절)
  online_applicable boolean not null default true,            -- false면 C7 가점 미적용 (PRD 06절)
  op_type           text,                                      -- 직영 · 가맹 · 무인 (확인 시 기입)
  scope_status      text not null default 'active',            -- active | excluded | knockout
  exclude_reason    text,                                       -- scope_status='excluded'일 때 사유 (팝업·무인기기)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_bcd_brands_category on bcd_brands(category_major, category_minor);
create index if not exists idx_bcd_brands_scope on bcd_brands(scope_status);

comment on table bcd_brands is 'BCD 평가 대상 브랜드 마스터. 335건 초기 등록 (부속 마스터 파일 기준)';
comment on column bcd_brands.scope_status is
  'active=평가 대상 · excluded=적용 제외(X, 팝업/무인기기, 목록엔 남김) · knockout=거래 불가(H, 점수 무관)';

-- ── 4. 기준(ruleset) 버전 ─────────────────────────────────────────────────
create table if not exists bcd_rulesets (
  id          uuid primary key default gen_random_uuid(),
  version     text not null unique,                          -- 'v1.0', 'v1.1' ...
  definition  jsonb not null,                                  -- criteria[] (mode 포함) · cuts · na_policy
  is_active   boolean not null default false,
  created_by  text,
  approved_by text,
  approved_at timestamptz,
  note        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists idx_bcd_rulesets_active
  on bcd_rulesets(is_active) where is_active;                 -- 활성 ruleset은 항상 1개

comment on table bcd_rulesets is
  '배점·경계값·등급컷·na_policy를 담은 기준 버전. definition 구조는 lib/bcd/score.ts의 Ruleset 타입과 1:1 대응';

-- ── 5. 지표 원값 (행 단위 누적) ────────────────────────────────────────────
create table if not exists bcd_metric_values (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references bcd_brands(id) on delete cascade,
  metric_code     text not null,                              -- 'C1' ... 'C8'
  value           numeric,                                     -- null이면 na_reason 필수
  na_reason       text,                                        -- 시계열부족·검색어미확정·매장미검출·현장미확인·표본부족
  source          text not null,                                -- 'kakao_map' | 'naver_ads' | 'manual' | 'ftc_franchise'
  detail          jsonb,                                        -- 원천별 부가정보 (조회 URL·매칭 점포 등)
  checked_on      date not null default current_date,
  checked_by      text,
  snapshot_run_id uuid references bcd_snapshot_runs(id),
  created_at      timestamptz not null default now()
);
create index if not exists idx_bcd_metric_values_brand on bcd_metric_values(brand_id, metric_code, checked_on desc);

comment on table bcd_metric_values is
  '지표 원값 이력. 같은 brand_id+metric_code가 여러 행일 수 있음(시계열). 평가 시점의 최신값을 score.ts가 선택';
comment on column bcd_metric_values.value is
  'null 허용. null이면 na_reason 필수 — 0으로 넣으면 안 됨(PRD 08.2절 핵심 원칙)';

-- ── 6. 매장 스냅샷 ───────────────────────────────────────────────────────────
create table if not exists bcd_store_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  snapshot_run_id     uuid not null references bcd_snapshot_runs(id) on delete cascade,
  brand_id            uuid references bcd_brands(id),
  place_name          text not null,
  place_id            text,                                    -- 카카오맵 place id
  lat                 numeric,
  lng                 numeric,
  dong_code           text,                                     -- 행정동 코드 (C2 상권 매칭용)
  is_hotspot          boolean default false,
  is_benchmark        boolean default false,
  benchmark_list_id   uuid references bcd_lists(id),             -- list_type='benchmark' 인 bcd_lists 행
  needs_review        boolean default false,                     -- C1 자동매칭 후 담당자 확인 필요 (PRD 11.3절)
  is_mall             boolean default false,
  raw                 jsonb,                                     -- API 원본 응답 보관
  created_at          timestamptz not null default now()
);
create index if not exists idx_bcd_store_snapshots_brand on bcd_store_snapshots(brand_id, snapshot_run_id);
create index if not exists idx_bcd_store_snapshots_dong on bcd_store_snapshots(dong_code);

comment on column bcd_store_snapshots.benchmark_list_id is
  '반드시 list_type=''benchmark''인 bcd_lists 행을 가리켜야 함 (DB 레벨 체크 대신 애플리케이션에서 강제)';

-- ── 7. 검색량 시계열 ───────────────────────────────────────────────────────
create table if not exists bcd_search_volume (
  brand_id uuid not null references bcd_brands(id) on delete cascade,
  keyword  text not null,
  ym       text not null,                                     -- 'YYYY-MM'
  pc       int,
  mobile   int,
  total    int generated always as (coalesce(pc,0) + coalesce(mobile,0)) stored,
  source   text not null default 'naver_ads',
  primary key (brand_id, keyword, ym)
);

comment on table bcd_search_volume is
  'C4(수준)·C5(전년비 파생)의 원천. 절대 검색수만 저장 — 데이터랩 상대지수(0~100) 저장 금지(PRD 04.3절)';

-- ── 8. 평가 결과 ───────────────────────────────────────────────────────────
create table if not exists bcd_evaluations (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references bcd_brands(id) on delete cascade,
  ruleset_version text not null references bcd_rulesets(version),
  list_versions   jsonb not null,                              -- {benchmark:'v1.0', hotspot:'v1.0', channel:'v1.0'}
  base_score      int not null,                                 -- 기본 100점 환산
  bonus_score     int not null default 0,                       -- C7 가점
  total           int not null,                                  -- base + bonus (최대 105)
  grade           text not null,                                  -- A · B+ · B · C · N · H · X · 미평가
  breakdown       jsonb not null,                                 -- {C1:{value,score,rank?}, ...}
  na_codes        text[] not null default '{}',
  na_points       int not null default 0,
  search_position text,                                            -- 성장·둔화·신흥·침체·null (C4/C5 둘다 있을 때만)
  evaluated_at    timestamptz not null default now(),
  evaluated_by    text,
  valid_until     date,                                             -- 다음 재평가 예정일
  created_at      timestamptz not null default now()
);
create index if not exists idx_bcd_evaluations_brand on bcd_evaluations(brand_id, evaluated_at desc);
create index if not exists idx_bcd_evaluations_grade on bcd_evaluations(grade);

comment on table bcd_evaluations is
  '평가 결과 스냅샷. 기준이 바뀌어도 과거 행은 그대로 — ruleset_version이 그 시점 기준을 가리킴(PRD 10.2절 소급 정책)';

-- ── 9. 부적격·예외조정 ───────────────────────────────────────────────────
create table if not exists bcd_flags (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references bcd_brands(id) on delete cascade,
  flag_type   text not null,                                   -- 'knockout' | 'override'
  reason      text not null,
  adjustment  int,                                                -- override 전용: 조정폭
  approved_by text not null,
  approved_at timestamptz not null default now(),
  valid_until date,
  created_at  timestamptz not null default now()
);

comment on table bcd_flags is
  'H(거래불가)·Override(예외조정) 이력. 점수를 고치지 않고 이력으로 얹음(PRD 08.3절)';

-- ============================================================================
-- RLS: 기존 GANA 인증(Google/GitHub/이메일) 재사용 전제. 조회는 인증 사용자 전체,
-- 쓰기는 서비스 롤(API 라우트) 또는 담당 역할로 제한. 실제 정책은 GANA의 기존
-- profiles/role 테이블 구조를 봐야 정확히 맞출 수 있어 아래는 최소 골격만 제공.
-- ============================================================================
alter table bcd_brands enable row level security;
alter table bcd_evaluations enable row level security;
alter table bcd_metric_values enable row level security;

-- 재실행 안전(멱등): create policy는 if not exists 미지원이라 먼저 drop.
drop policy if exists "authenticated read" on bcd_brands;
drop policy if exists "authenticated read" on bcd_evaluations;
drop policy if exists "authenticated read" on bcd_metric_values;
create policy "authenticated read" on bcd_brands for select using (auth.role() = 'authenticated');
create policy "authenticated read" on bcd_evaluations for select using (auth.role() = 'authenticated');
create policy "authenticated read" on bcd_metric_values for select using (auth.role() = 'authenticated');
-- 쓰기 정책은 GANA의 기존 role 체계 확인 후 추가 (PRD 14절 검토요청 #7: 기준변경 승인권자)
