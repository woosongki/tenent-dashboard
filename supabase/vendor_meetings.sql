-- ============================================================
-- VENDOR_MEETINGS — 업체미팅 워크플로우 (Stage 1: 사전 자료)
-- 한 row = 한 업체에 대한 미팅 컨텍스트.
-- Stage 1(brief): DART · 뉴스 · 검색 트렌드 등 사전 수집 데이터.
-- Stage 2(meeting): 질문/답변 (추후).
-- Stage 3(proposal): 제안 매장/공간 (추후).
-- 동일 브랜드 재조회 시 24시간 내 가장 최근 row를 캐시로 사용.
-- 여러 번 실행해도 안전(멱등).
-- ============================================================

create table if not exists public.vendor_meetings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand           text not null,                                  -- 사용자 입력 브랜드명 (popup-contacts 또는 자유 입력)
  company         text,                                           -- DART 정식 회사명 (매칭 성공 시)
  corp_code       text,                                           -- DART corp_code (있으면)
  stage           text not null default 'brief',                  -- brief | meeting | proposal | done
  brief_payload   jsonb,                                          -- { dart, financials, disclosures, news, trend, shopping, fetchedAt }
  brief_summary   text,                                           -- 룰 기반 TL;DR
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_vendor_meetings_org_brand on public.vendor_meetings(organization_id, brand);
create index if not exists idx_vendor_meetings_created   on public.vendor_meetings(organization_id, created_at desc);
create index if not exists idx_vendor_meetings_corp      on public.vendor_meetings(corp_code);

-- ── updated_at 자동 갱신 트리거 ──────────────────────────────
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_vendor_meetings_updated_at') then
    create trigger trg_vendor_meetings_updated_at
      before update on public.vendor_meetings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── RLS — 조직 멤버 조회/생성/수정, admin 삭제 ───────────────
alter table public.vendor_meetings enable row level security;

drop policy if exists "vendor_meetings: 멤버 조회"  on public.vendor_meetings;
drop policy if exists "vendor_meetings: 멤버 생성"  on public.vendor_meetings;
drop policy if exists "vendor_meetings: 멤버 수정"  on public.vendor_meetings;
drop policy if exists "vendor_meetings: admin 삭제" on public.vendor_meetings;

create policy "vendor_meetings: 멤버 조회"
  on public.vendor_meetings for select
  using (public.is_org_member(organization_id));

create policy "vendor_meetings: 멤버 생성"
  on public.vendor_meetings for insert
  with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

create policy "vendor_meetings: 멤버 수정"
  on public.vendor_meetings for update
  using (public.is_org_member(organization_id));

create policy "vendor_meetings: admin 삭제"
  on public.vendor_meetings for delete
  using (public.is_org_admin(organization_id));
