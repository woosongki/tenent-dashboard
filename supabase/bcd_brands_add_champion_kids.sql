-- ============================================================================
-- 브랜드 등록: 챔피온 (키즈카페) — 2026-11 요청.
-- 분류: 키즈·교육 / 키즈카페·놀이시설 (헬로방방·짐보리·키즈맥스 등과 같은 비교군).
--
-- ⚠ 이름 충돌 주의: 기존 '챔피언'(리테일·기타/패션·잡화, 의류 브랜드)과 별개 브랜드다.
--   - 이름은 매출 데이터 표기(brand_grade '챔피온')에 맞춰 '챔피온'.
--   - 검색어는 '챔피온 키즈카페'로 좁힌다. 카카오 수집은 검색 결과를 이름 필터 없이
--     전부 매장 수(C3)로 세므로, '챔피온'만 쓰면 의류 매장·태권도장 등 동명 업장이 섞인다.
--     (네이버 검색량은 공백을 제거해 '챔피온키즈카페'로 조회됨)
--
-- 기본값: C8 감도 5, C6 순증률 5. C1은 미입력(0점) — 콘솔 'C1 입점 편집'에서 체크.
-- 멱등: 이름·소스 기준 중복 방지.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select '챔피온', array['챔피온 키즈카페']::text[], '키즈·교육', '키즈카페·놀이시설', true
where not exists (select 1 from bcd_brands b where b.name = '챔피온');

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.name = '챔피온'
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

-- 확인용 (의류 '챔피언'과 나란히 보여 구분 확인)
select b.name, b.search_keywords, b.category_major, b.category_minor, b.scope_status,
       array_agg(m.metric_code || '=' || m.value order by m.metric_code) as metrics
from bcd_brands b
left join bcd_metric_values m on m.brand_id = b.id
where b.name in ('챔피온', '챔피언')
group by b.name, b.search_keywords, b.category_major, b.category_minor, b.scope_status;
