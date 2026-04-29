-- ============================================================
-- AUDIT LOGS — 편집 이력
-- ============================================================

-- ── 테이블 ────────────────────────────────────────────────────
create table public.audit_logs (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        references public.organizations(id) on delete set null,
  actor_id        uuid        references auth.users(id) on delete set null,
  actor_email     text,                          -- 유저 삭제 후에도 보존
  entity_type     text        not null,          -- 'goal' | 'member' | 'invitation' | ...
  entity_id       text        not null,
  entity_label    text,                          -- 당시 엔티티 이름 스냅샷
  action          text        not null,          -- 'created' | 'updated' | 'deleted' | 'status_changed'
  field           text,                          -- 수정된 필드명 (updated 시)
  old_value       text,
  new_value       text,
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now()
);

-- 인덱스
create index idx_audit_org        on public.audit_logs(organization_id, created_at desc);
create index idx_audit_entity     on public.audit_logs(entity_type, entity_id);
create index idx_audit_actor      on public.audit_logs(actor_id);
create index idx_audit_action     on public.audit_logs(action);
create index idx_audit_created    on public.audit_logs(created_at desc);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.audit_logs enable row level security;

-- admin 이상만 조회
create policy "audit_logs: admin 이상 조회"
  on public.audit_logs for select
  using (
    organization_id is null
    or public.is_org_admin(organization_id)
  );

-- INSERT는 service_role / trigger (security definer) 전용
-- UPDATE / DELETE 금지 (불변 로그)


-- ============================================================
-- GOALS 변경 자동 로깅 트리거
-- ============================================================

-- ── 헬퍼: actor 이메일 조회 ───────────────────────────────────
create or replace function public.get_actor_email(p_uid uuid)
returns text language sql security definer stable as $$
  select email from auth.users where id = p_uid limit 1;
$$;

-- ── INSERT 트리거 ─────────────────────────────────────────────
create or replace function public.audit_goal_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.audit_logs
    (organization_id, actor_id, actor_email, entity_type, entity_id,
     entity_label, action, metadata)
  values (
    new.organization_id,
    v_actor,
    public.get_actor_email(v_actor),
    'goal',
    new.id::text,
    new.title,
    'created',
    jsonb_build_object(
      'category', new.category,
      'period',   new.period,
      'target',   new.target_value,
      'unit',     new.unit
    )
  );
  return null;
end;
$$;

create trigger trg_audit_goal_insert
  after insert on public.goals
  for each row execute function public.audit_goal_insert();

-- ── UPDATE 트리거 ─────────────────────────────────────────────
create or replace function public.audit_goal_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_email text := public.get_actor_email(v_actor);

  -- 감시할 (필드명, 표시명) 쌍
  type field_pair is record (col text, label text);
  fields field_pair[] := array[
    row('title',         '목표명')::field_pair,
    row('current_value', '현재값')::field_pair,
    row('target_value',  '목표값')::field_pair,
    row('status',        '상태')::field_pair,
    row('category',      '카테고리')::field_pair,
    row('description',   '설명')::field_pair
  ];
  f field_pair;
  v_old text;
  v_new text;
  v_action text;
begin
  foreach f in array fields loop
    execute format('select ($1).%I::text', f.col) into v_old using old;
    execute format('select ($1).%I::text', f.col) into v_new using new;

    if v_old is distinct from v_new then
      v_action := case when f.col = 'status' then 'status_changed' else 'updated' end;

      insert into public.audit_logs
        (organization_id, actor_id, actor_email, entity_type, entity_id,
         entity_label, action, field, old_value, new_value)
      values (
        new.organization_id,
        v_actor,
        v_email,
        'goal',
        new.id::text,
        new.title,
        v_action,
        f.label,
        v_old,
        v_new
      );
    end if;
  end loop;
  return null;
end;
$$;

create trigger trg_audit_goal_update
  after update on public.goals
  for each row execute function public.audit_goal_update();

-- ── DELETE 트리거 ─────────────────────────────────────────────
create or replace function public.audit_goal_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.audit_logs
    (organization_id, actor_id, actor_email, entity_type, entity_id,
     entity_label, action, metadata)
  values (
    old.organization_id,
    v_actor,
    public.get_actor_email(v_actor),
    'goal',
    old.id::text,
    old.title,             -- 삭제된 이름도 스냅샷 보존
    'deleted',
    jsonb_build_object('category', old.category, 'period', old.period)
  );
  return null;
end;
$$;

create trigger trg_audit_goal_delete
  after delete on public.goals
  for each row execute function public.audit_goal_delete();
