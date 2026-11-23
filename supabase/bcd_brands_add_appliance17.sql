-- ============================================================================
-- 가전·전자 대분류 브랜드 17개 추가 (2026-11 요청 "다 추가").
-- 전제: bcd_category_split_appliance.sql 적용(대분류 '가전·전자'). 미적용이어도 실행은 됨.
--
-- 검색어(search_keywords) 원칙: 카카오 매장 수(C3)는 검색 결과를 이름 필터 없이 전부
--   세므로, 일반명사와 겹치는 이름은 좁힌 검색어를 쓴다(예: '마샬' → 마샬아츠 도장 혼입).
--   단, 같은 검색어가 네이버 검색량(C4·C5)에도 쓰여 좁힌 브랜드는 검색량이 작게 잡힌다.
-- 세라젬: 기존 '세라젬 웰파크'(스포츠·레저)는 그대로 두고 가전 매장으로 별도 추가.
-- 기본값: C8 감도 5, C6 순증률 5. C1 미입력(0점). 멱등.
-- ============================================================================
insert into bcd_brands (name, search_keywords, category_major, category_minor, online_applicable)
select v.name, v.kw, '가전·전자', '가전·전자', true
from (values
  ('삼성스토어',       array['삼성스토어', '삼성디지털프라자']::text[]),
  ('LG전자 베스트샵',  array['LG전자 베스트샵']::text[]),
  ('일렉트로마트',     array['일렉트로마트']::text[]),
  ('다이슨',           array['다이슨 데모스토어']::text[]),
  ('발뮤다',           array['발뮤다']::text[]),
  ('소니스토어',       array['소니스토어']::text[]),
  ('뱅앤올룹슨',       array['뱅앤올룹슨']::text[]),
  ('마샬',             array['마샬 스피커']::text[]),
  ('프리스비',         array['프리스비']::text[]),
  ('에이샵',           array['에이샵']::text[]),
  ('윌리스',           array['윌리스']::text[]),
  ('코웨이',           array['코웨이']::text[]),
  ('쿠쿠',             array['쿠쿠']::text[]),
  ('휴테크',           array['휴테크 안마의자']::text[]),
  ('코지마',           array['코지마 안마의자']::text[]),
  ('세라젬',           array['세라젬']::text[]),
  ('샤오미',           array['샤오미 스토어']::text[])
) as v(name, kw)
where not exists (select 1 from bcd_brands b where b.name = v.name);

insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, c.code, 5, 'manual_default', 'seed:' || c.code || '_default'
from bcd_brands b
cross join (values ('C8'), ('C6')) as c(code)
where b.category_major = '가전·전자'
  and b.name in ('삼성스토어','LG전자 베스트샵','일렉트로마트','다이슨','발뮤다','소니스토어','뱅앤올룹슨',
                 '마샬','프리스비','에이샵','윌리스','코웨이','쿠쿠','휴테크','코지마','세라젬','샤오미')
  and not exists (
    select 1 from bcd_metric_values m
    where m.brand_id = b.id and m.metric_code = c.code and m.source = 'manual_default'
  );

-- 확인용: 가전·전자 전체
select name, search_keywords, scope_status
from bcd_brands
where category_major = '가전·전자'
order by name;
