-- ============================================================================
-- 브랜드 2개 등록: 무인양품, 니토리 (2026-11 요청).
-- 대/중분류는 기존 비교군에 맞춤 — 백분위(C3·C4)가 같은 중분류 안에서 매겨지므로.
--   무인양품 → 리테일·기타 / 생활잡화·리세일 (다이소와 같은 비교군)
--   니토리   → 홈·리빙 / 가구               (한샘·일룸·데스커와 같은 비교군)
-- 기본값도 함께: C8 감도 5(전 브랜드 기본), C6 순증률 5(첫 수집 전 중간값).
-- C1(벤치마크 입점)은 넣지 않음 — 미입력 = 0점. 입점 유통은 콘솔 'C1 입점 편집'에서 체크.
-- 멱등: 이름·소스 기준 중복 방지(여러 번 실행해도 안전).
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select v.name, array[v.name]::text[], v.major, v.minor, true
from (values
  ('무인양품', '리테일·기타', '생활잡화·리세일'),
  ('니토리',   '홈·리빙',     '가구')
) as v(name, major, minor)
where not exists (select 1 from bcd_brands b where b.name = v.name);

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.name in ('무인양품', '니토리')
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

-- 확인용
select b.name, b.category_major, b.category_minor, b.scope_status,
       array_agg(m.metric_code || '=' || m.value order by m.metric_code) as metrics
from bcd_brands b
left join bcd_metric_values m on m.brand_id = b.id
where b.name in ('무인양품', '니토리')
group by b.name, b.category_major, b.category_minor, b.scope_status;
