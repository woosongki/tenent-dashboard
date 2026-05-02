-- ============================================================
-- FLOORPLANS — 전점 층별 도면 관리
-- 한 점포에 층(B2/B1/1F/2F/...)별로 도면 파일 1개씩 업로드
-- ============================================================

create table if not exists public.floorplans (
  id           uuid primary key default gen_random_uuid(),
  store_id     text not null,                       -- stores.json의 id
  floor_label  text not null,                       -- "B1", "1F", "2F", "3F", "RF" 등
  storage_path text not null,                       -- Storage 내부 경로 (storeId/filename)
  public_url   text not null,                       -- 공개 URL
  mime_type    text not null,
  size_bytes   bigint not null,
  sort_order   int  not null default 0,             -- 층 정렬 순서 (B2=-2, 1F=1 …)
  uploaded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, floor_label)
);

create index if not exists idx_floorplans_store on public.floorplans(store_id, sort_order);

create trigger trg_floorplans_updated_at
  before update on public.floorplans
  for each row execute function public.set_updated_at();

-- RLS: 인증 유저 누구나 조회 / 수정
alter table public.floorplans enable row level security;

create policy "floorplans: 인증 유저 조회"
  on public.floorplans for select
  using (auth.uid() is not null);

create policy "floorplans: 인증 유저 수정"
  on public.floorplans for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);


-- ============================================================
-- Supabase Storage 버킷 — public 읽기 허용 (이미지 직접 표시용)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'floorplans',
  'floorplans',
  true,                                 -- 공개 버킷 (이미지 직접 src에 사용)
  20971520,                             -- 20 MB
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 인증된 유저 누구나 업로드/삭제
create policy "floorplans-storage: 인증 유저 업로드"
  on storage.objects for insert
  with check (bucket_id = 'floorplans' and auth.uid() is not null);

create policy "floorplans-storage: 인증 유저 삭제"
  on storage.objects for delete
  using (bucket_id = 'floorplans' and auth.uid() is not null);

create policy "floorplans-storage: 모두 조회 (공개 버킷)"
  on storage.objects for select
  using (bucket_id = 'floorplans');
