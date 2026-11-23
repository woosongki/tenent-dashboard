-- ============================================================================
-- 브랜드 등록: 슬립퍼 (2026-11 요청).
-- 분류: 홈·리빙 / 침구·매트리스 — 이름(수면) 기준 추정. 다르면 콘솔/SQL로 수정.
-- 참고: '슬립앤슬립'(매트리스)은 별개 브랜드로 최초 시드에 이미 등록돼 있음.
-- 기본값: C8 감도 5, C6 순증률 5. C1 미입력(0점). 멱등.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select '슬립퍼', array['슬립퍼']::text[], '홈·리빙', '침구·매트리스', true
where not exists (select 1 from bcd_brands b where b.name = '슬립퍼');

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.name = '슬립퍼'
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

select name, category_major, category_minor, scope_status from bcd_brands where name = '슬립퍼';
