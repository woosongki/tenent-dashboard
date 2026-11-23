-- ============================================================================
-- 브랜드 등록 (2026-11 요청): 이케아, 테슬라
--   이케아 → 홈·리빙 / 가구      (한샘·일룸·니토리와 같은 비교군)
--   테슬라 → 생활서비스 / 자동차  (BMW·BYD와 같은 비교군)
-- 테슬라 검색어: '테슬라'만 쓰면 카카오 결과에 슈퍼차저(충전소)가 대거 잡혀 매장 수(C3)가
--   부풀려진다 → 매장·전시장으로 좁힘. (네이버 검색량도 같은 검색어라 작게 잡힘)
-- 기본값: C8 감도 5, C6 순증률 5. C1 미입력(0점). 멱등.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select v.name, v.kw, v.major, v.minor, true
from (values
  ('이케아', array['이케아']::text[],                       '홈·리빙',   '가구'),
  ('테슬라', array['테슬라 스토어', '테슬라 전시장']::text[], '생활서비스', '자동차')
) as v(name, kw, major, minor)
where not exists (select 1 from bcd_brands b where b.name = v.name);

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.name in ('이케아', '테슬라')
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

select name, category_major, category_minor, search_keywords, scope_status
from bcd_brands where name in ('이케아', '테슬라');
