-- ============================================================================
-- 리빙 브랜드 추가 (2026-11 요청): 자코모, 슬립앤슬립, 세사, 다우닝, 에싸, 이브자리, 지누스
--   가구:            자코모, 다우닝, 에싸        (한샘·일룸·니토리·샤또와 같은 비교군)
--   침구·매트리스:   세사, 이브자리, 지누스, 슬립앤슬립 (디바코·자라홈·슬립퍼와 같은 비교군)
-- 슬립앤슬립: 최초 시드에 이미 있음 → 없을 때(콘솔에서 삭제된 경우)만 복원.
-- 세사: 요청 표기 '쎼사'를 침구 브랜드 '세사(세사리빙)'로 해석. 다르면 알려주세요.
-- 기본값: 새로 들어간 브랜드만 C8 감도 5, C6 순증률 5. C1 미입력(0점). 멱등.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select v.name, v.kw, '홈·리빙', v.minor, true
from (values
  ('자코모',     array['자코모']::text[],       '가구'),
  ('다우닝',     array['다우닝']::text[],       '가구'),
  ('에싸',       array['에싸']::text[],         '가구'),
  ('세사',       array['세사리빙']::text[],     '침구·매트리스'),
  ('이브자리',   array['이브자리']::text[],     '침구·매트리스'),
  ('지누스',     array['지누스']::text[],       '침구·매트리스'),
  ('슬립앤슬립', array['슬립앤슬립']::text[],   '침구·매트리스')
) as v(name, kw, minor)
where not exists (select 1 from bcd_brands b where b.name = v.name);

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.name in ('자코모','다우닝','에싸','세사','이브자리','지누스','슬립앤슬립')
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

-- 확인용: 홈·리빙 가구/침구 전체
select name, category_minor, search_keywords, scope_status
from bcd_brands
where category_major = '홈·리빙' and category_minor in ('가구', '침구·매트리스')
order by category_minor, name;
