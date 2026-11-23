-- ============================================================================
-- 브랜드 추가 요청(2026-11-23): 예스24, 블럭버스, 브루미즈, 디바코, 샤또
--
-- 예스24·블럭버스·브루미즈는 최초 시드(bcd_brands_seed.sql)에 이미 있다.
--   예스24는 'YES24'(영문)로 등록돼 있어 콘솔에서 '예스24'로 찾으면 안 보인다.
--   → 이미 있으면 아무것도 하지 않고, 콘솔에서 삭제됐던 경우에만 시드와 같은 값으로 복원.
-- 디바코 → 홈·리빙 / 침구·매트리스, 샤또 → 홈·리빙 / 가구 (사용자 지정 분류).
-- 기본값: 새로 들어간 브랜드만 C8 감도 5, C6 순증률 5. 멱등.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select v.name, v.kw, v.major, v.minor, v.online
from (values
  ('YES24',   array['YES24', '예스24']::text[], '문화·엔터', '서점·문구',         true),
  ('블럭버스', array['블럭버스']::text[],         '키즈·교육', '키즈카페·놀이시설', false),
  ('브루미즈', array['브루미즈']::text[],         '키즈·교육', '키즈카페·놀이시설', false),
  ('디바코',   array['디바코']::text[],           '홈·리빙',   '침구·매트리스',     true),
  ('샤또',     array['샤또']::text[],             '홈·리빙',   '가구',             true)
) as v(name, kw, major, minor, online)
-- YES24는 한글 표기('예스24')로 들어가 있어도 중복 생성하지 않는다
where not exists (
  select 1 from bcd_brands b
  where b.name = v.name or (v.name = 'YES24' and b.name = '예스24')
);

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.name in ('YES24', '예스24', '블럭버스', '브루미즈', '디바코', '샤또')
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

-- 확인용: 이름·범위(제외/거래불가면 콘솔에서 흐리게 표시됨)
select b.name, b.category_major, b.category_minor, b.scope_status, b.created_at::date
from bcd_brands b
where b.name in ('YES24', '예스24', '블럭버스', '브루미즈', '디바코', '샤또')
order by b.name;
