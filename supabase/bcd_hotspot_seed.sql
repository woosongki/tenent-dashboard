-- ============================================================================
-- 핫플 상권 — 전국 핵심상권 51곳 (v1.0 초기값).
-- 적용: bcd_schema.sql 실행 후. C2(핫플 입점 수)는 카카오 수집 시 매장 주소가
--   각 상권의 match_strings(동/지역 키워드)와 겹치는 고유 매장 수로 산출된다.
-- match_strings는 카카오 주소(지번/도로명)에 실제 등장하는 키워드 — 첫 수집 결과를 보고
--   콘솔 '목록 관리'에서 조정하세요(상권 추가·키워드 보정 가능).
-- 멱등: 같은 (list_type,name)이 있으면 건너뜀.
-- ============================================================================
insert into bcd_lists (list_type, version, name, match_strings)
select v.list_type, v.version, v.name, v.match_strings
from (values
  ('hotspot','v1.0','강남역·역삼', array['역삼동','강남대로']::text[]),
  ('hotspot','v1.0','신사·가로수길', array['신사동','가로수길']::text[]),
  ('hotspot','v1.0','압구정·청담', array['압구정동','청담동']::text[]),
  ('hotspot','v1.0','삼성·코엑스', array['삼성동','영동대로']::text[]),
  ('hotspot','v1.0','잠실', array['잠실동','올림픽로']::text[]),
  ('hotspot','v1.0','홍대', array['서교동','동교동','양화로']::text[]),
  ('hotspot','v1.0','연남동', array['연남동']::text[]),
  ('hotspot','v1.0','합정·망원', array['합정동','망원동']::text[]),
  ('hotspot','v1.0','신촌·이대', array['창천동','대현동']::text[]),
  ('hotspot','v1.0','이태원·한남', array['이태원동','한남동']::text[]),
  ('hotspot','v1.0','명동', array['명동','을지로']::text[]),
  ('hotspot','v1.0','성수', array['성수동']::text[]),
  ('hotspot','v1.0','건대입구', array['화양동','자양동']::text[]),
  ('hotspot','v1.0','왕십리', array['행당동','왕십리로']::text[]),
  ('hotspot','v1.0','여의도', array['여의도동']::text[]),
  ('hotspot','v1.0','영등포', array['영등포동','경인로']::text[]),
  ('hotspot','v1.0','종로·인사동', array['종로','관철동','인사동']::text[]),
  ('hotspot','v1.0','광화문', array['세종대로','종로1가']::text[]),
  ('hotspot','v1.0','대학로', array['동숭동','혜화동']::text[]),
  ('hotspot','v1.0','노원·상계', array['상계동','노해로']::text[]),
  ('hotspot','v1.0','미아·수유', array['번동','수유동','도봉로']::text[]),
  ('hotspot','v1.0','천호', array['천호동']::text[]),
  ('hotspot','v1.0','목동', array['목동','오목로']::text[]),
  ('hotspot','v1.0','사당·이수', array['사당동','동작대로']::text[]),
  ('hotspot','v1.0','문래·영등포', array['문래동']::text[]),
  ('hotspot','v1.0','수원 인계동', array['인계동','권선로']::text[]),
  ('hotspot','v1.0','수원 스타필드', array['정자동','팔달로']::text[]),
  ('hotspot','v1.0','성남 판교', array['삼평동','판교역로']::text[]),
  ('hotspot','v1.0','분당 서현·정자', array['서현동','정자동']::text[]),
  ('hotspot','v1.0','일산 라페스타', array['장항동','일산로']::text[]),
  ('hotspot','v1.0','부천 중동', array['중동','길주로']::text[]),
  ('hotspot','v1.0','안양 범계', array['호계동','평촌대로']::text[]),
  ('hotspot','v1.0','인천 구월동', array['구월동','예술로']::text[]),
  ('hotspot','v1.0','인천 송도', array['송도동']::text[]),
  ('hotspot','v1.0','인천 부평', array['부평동']::text[]),
  ('hotspot','v1.0','부산 서면', array['부전동','전포동']::text[]),
  ('hotspot','v1.0','부산 광복동·남포', array['광복동','남포동']::text[]),
  ('hotspot','v1.0','부산 해운대', array['우동','해운대']::text[]),
  ('hotspot','v1.0','부산 센텀', array['재송동','센텀']::text[]),
  ('hotspot','v1.0','대구 동성로', array['동성로','삼덕동']::text[]),
  ('hotspot','v1.0','대구 수성', array['범어동','들안로']::text[]),
  ('hotspot','v1.0','대전 둔산', array['둔산동']::text[]),
  ('hotspot','v1.0','대전 은행동', array['은행동','중앙로']::text[]),
  ('hotspot','v1.0','광주 충장로', array['충장로','금남로']::text[]),
  ('hotspot','v1.0','광주 상무', array['치평동','상무']::text[]),
  ('hotspot','v1.0','울산 삼산', array['삼산동']::text[]),
  ('hotspot','v1.0','창원 상남', array['상남동']::text[]),
  ('hotspot','v1.0','전주 객사·한옥마을', array['고사동','교동']::text[]),
  ('hotspot','v1.0','청주 성안길', array['북문로','성안길']::text[]),
  ('hotspot','v1.0','천안 신부동', array['신부동','불당동']::text[]),
  ('hotspot','v1.0','제주 연동·노형', array['연동','노형동']::text[])
) as v(list_type, version, name, match_strings)
where not exists (
  select 1 from bcd_lists l where l.list_type = v.list_type and l.name = v.name
);
