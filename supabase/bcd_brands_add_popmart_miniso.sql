-- ============================================================================
-- 브랜드 등록 (2026-11 요청): 팝마트, 미니소
--   팝마트 → 키즈·교육 / 완구           (건담베이스·가샤폰·레고 등 캐릭터·수집형과 같은 비교군)
--   미니소 → 리테일·기타 / 생활잡화·리세일 (다이소·무인양품과 같은 비교군)
-- 기본값: C8 감도 5, C6 순증률 5. C1 미입력(0점). 멱등.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select v.name, v.kw, v.major, v.minor, true
from (values
  ('팝마트', array['팝마트']::text[], '키즈·교육',   '완구'),
  ('미니소', array['미니소']::text[], '리테일·기타', '생활잡화·리세일')
) as v(name, kw, major, minor)
where not exists (select 1 from bcd_brands b where b.name = v.name);

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.name in ('팝마트', '미니소')
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

select name, category_major, category_minor, scope_status from bcd_brands where name in ('팝마트', '미니소');
