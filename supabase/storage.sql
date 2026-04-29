-- Supabase Storage 버킷 생성 및 RLS 정책
-- 대시보드 > SQL Editor 에서 실행

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'excel-uploads',
  'excel-uploads',
  false,                            -- 비공개 버킷
  10485760,                         -- 10 MB
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- 조직 멤버만 자신의 조직 폴더에 업로드/조회 가능
create policy "excel-uploads: 멤버 업로드"
  on storage.objects for insert
  with check (
    bucket_id = 'excel-uploads'
    and exists (
      select 1 from public.organization_members
      where organization_id::text = (storage.foldername(name))[1]
        and user_id = auth.uid()
    )
  );

create policy "excel-uploads: 멤버 조회"
  on storage.objects for select
  using (
    bucket_id = 'excel-uploads'
    and exists (
      select 1 from public.organization_members
      where organization_id::text = (storage.foldername(name))[1]
        and user_id = auth.uid()
    )
  );

create policy "excel-uploads: admin 이상 삭제"
  on storage.objects for delete
  using (
    bucket_id = 'excel-uploads'
    and exists (
      select 1 from public.organization_members
      where organization_id::text = (storage.foldername(name))[1]
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );
