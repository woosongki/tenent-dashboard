-- ============================================================================
-- 미등록 7개 브랜드 등록 + 롯데월드몰 입점(C1) 반영.
-- 대/중분류는 마스터 분류체계(02_분류체계) 표기에 맞춤. online_applicable=true(가점 평가).
-- 적용 후 bcd_c8_seed.sql·bcd_c6_seed.sql 재실행하면 이 7개도 C8·C6 기본값(5)이 채워짐.
-- 멱등: 이름/소스 기준 중복 방지.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select v.name, array[v.name]::text[], v.major, v.minor, true
from (values
  ('데스커', '홈·리빙', '가구'),
  ('아크앤북', '문화·엔터', '서점·문구'),
  ('애플스토어', '리테일·기타', '가전·전자'),
  ('자라홈', '홈·리빙', '침구·매트리스'),
  ('플레이스테이션', '리테일·기타', '가전·전자'),
  ('이구일포토그랩스', '리테일·기타', '가전·전자'),
  ('후지필름', '리테일·기타', '가전·전자')
) as v(name, major, minor)
where not exists (select 1 from bcd_brands b where b.name = v.name);

-- C1 = 롯데월드몰 1곳 → value = 1 ÷ 전수조사 유통수 × 100
insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by, detail)
select b.id, 'C1',
       round(1::numeric / greatest((select count(*) from bcd_lists where list_type='benchmark' and is_full_survey), 1) * 100),
       'benchmark_manual', 'seed:add7', jsonb_build_object('malls', array['롯데월드몰']::text[])
from bcd_brands b
where b.name in ('데스커','아크앤북','애플스토어','자라홈','플레이스테이션','이구일포토그랩스','후지필름')
  and not exists (
    select 1 from bcd_metric_values m where m.brand_id = b.id and m.metric_code='C1' and m.source='benchmark_manual'
  );
