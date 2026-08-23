-- ============================================================================
-- C1 입점 매트릭스 시드 — 첨부 BCD_C1 v1.0(2026-08-21) 51건 + 롯데월드몰 추가.
-- 입점한 벤치마크 유통 목록(detail.malls)을 저장하고 value=목록수÷10×100(%)로 계산.
-- source=benchmark_manual (콘솔 'C1 입점 편집'과 동일 소스 — 이후 UI로 유지보수).
-- 롯데월드몰 추가 반영: 다이소·루이독(기존+롯데월드몰), 롯데시네마·하이마트(롯데월드몰).
--   ※ 미등록 7개(데스커·아크앤북·애플스토어·자라홈·플레이스테이션·이구일포토그랩스·후지필름)는
--     브랜드 등록 후 콘솔 'C1 입점 편집'에서 롯데월드몰 체크.
-- 적용: 기존 C1 정리 후 실행 권장 —
--   delete from bcd_metric_values where metric_code='C1' and source in ('kakao_map','benchmark_survey');
-- 멱등: 같은 브랜드에 benchmark_manual C1이 있으면 건너뜀.
-- ============================================================================
insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by, detail)
select b.id, 'C1', round(v.cnt::numeric / greatest((select count(*) from bcd_lists where list_type='benchmark' and is_full_survey), 1) * 100), 'benchmark_manual', 'seed:C1_matrix_v1.1',
       jsonb_build_object('malls', v.malls)
from (values
  ('템퍼', 5, array['더현대서울','스타필드 고양','용산아이파크몰','현대 김포','현대 송도']::text[]),
  ('한샘', 4, array['스타필드 고양','스타필드 하남','용산아이파크몰','타임스퀘어']::text[]),
  ('다이소', 5, array['스타필드 고양','스타필드 수원','스타필드 하남','스타필드 코엑스몰','롯데월드몰']::text[]),
  ('레고', 4, array['더현대서울','스타필드 코엑스몰','현대 김포','현대 송도']::text[]),
  ('일룸', 4, array['스타필드 고양','스타필드 수원','스타필드 하남','용산아이파크몰']::text[]),
  ('준오헤어', 3, array['더현대서울','스타필드 하남','스타필드 코엑스몰']::text[]),
  ('씰리', 3, array['더현대서울','현대 김포','현대 송도']::text[]),
  ('아트박스', 3, array['스타필드 수원','스타필드 코엑스몰','현대 송도']::text[]),
  ('플레이인더박스', 3, array['더현대서울','스타필드 수원','현대 송도']::text[]),
  ('디자인스킨', 3, array['스타필드 수원','스타필드 하남','스타필드 코엑스몰']::text[]),
  ('알레르망', 3, array['롯데월드몰','스타필드 하남','용산아이파크몰']::text[]),
  ('알리페즈', 2, array['스타필드 수원','현대 송도']::text[]),
  ('하나투어', 2, array['스타필드 코엑스몰','현대 송도']::text[]),
  ('펫파크', 2, array['스타필드 고양','스타필드 하남']::text[]),
  ('비비안', 2, array['스타필드 고양','스타필드 코엑스몰']::text[]),
  ('건담베이스', 2, array['용산아이파크몰','스타필드 코엑스몰']::text[]),
  ('그레이트북스', 2, array['스타필드 수원','스타필드 코엑스몰']::text[]),
  ('메가박스', 2, array['스타필드 하남','스타필드 코엑스몰']::text[]),
  ('전자랜드', 2, array['현대 김포','현대 송도']::text[]),
  ('시디즈', 2, array['스타필드 고양','현대 김포']::text[]),
  ('정관장', 2, array['더현대서울','현대 김포']::text[]),
  ('영풍문고', 2, array['스타필드 수원','스타필드 코엑스몰']::text[]),
  ('하우스웨어', 2, array['스타필드 고양','스타필드 수원']::text[]),
  ('바디프랜드', 2, array['더현대서울','스타필드 수원']::text[]),
  ('바이이연', 1, array['스타필드 코엑스몰']::text[]),
  ('트니트니', 1, array['현대 송도']::text[]),
  ('반듯한 이비인후과 내과의원', 1, array['스타필드 수원']::text[]),
  ('펀시티', 1, array['스타필드 코엑스몰']::text[]),
  ('스킨밴드', 1, array['스타필드 코엑스몰']::text[]),
  ('째깍섬', 1, array['스타필드 수원']::text[]),
  ('참약사', 1, array['스타필드 수원']::text[]),
  ('타이거릴리', 1, array['현대 김포']::text[]),
  ('슬코', 1, array['스타필드 수원']::text[]),
  ('타임닥터', 1, array['더현대서울']::text[]),
  ('서울SIC치과', 1, array['스타필드 코엑스몰']::text[]),
  ('아람북스', 1, array['현대 김포']::text[]),
  ('챔피언', 1, array['스타필드 코엑스몰']::text[]),
  ('TGX골프', 1, array['스타필드 코엑스몰']::text[]),
  ('실리트', 1, array['현대 김포']::text[]),
  ('교보문고', 1, array['현대 송도']::text[]),
  ('타이거릴리', 1, array['현대 김포']::text[]),
  ('토니모리', 1, array['스타필드 코엑스몰']::text[]),
  ('테팔', 1, array['현대 김포']::text[]),
  ('스피드메이트', 1, array['스타필드 하남']::text[]),
  ('룩옵티컬', 1, array['현대 송도']::text[]),
  ('루이독', 2, array['현대 김포','롯데월드몰']::text[]),
  ('세라젬 웰파크', 0, array[]::text[]),
  ('메이린의원', 0, array[]::text[]),
  ('핫트랙스', 0, array[]::text[]),
  ('롯데시네마', 1, array['롯데월드몰']::text[]),
  ('하이마트', 1, array['롯데월드몰']::text[])
) as v(name, cnt, malls)
join bcd_brands b on b.name = v.name
where not exists (
  select 1 from bcd_metric_values m where m.brand_id = b.id and m.metric_code='C1' and m.source='benchmark_manual'
);
