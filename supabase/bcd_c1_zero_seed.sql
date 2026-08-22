-- ============================================================================
-- C1 미조사 브랜드 = 입점율 0% → 0점.
-- 벤치마크 유통 실측(bcd_c1_seed.sql)에 없는 브랜드는 "입점 없음"으로 보고 C1=0 부여.
-- 적용: bcd_c1_seed.sql 실행 후. (카카오 오매칭 C1이 남아 있으면 먼저 정리:
--        delete from bcd_metric_values where metric_code='C1' and source='kakao_map'; )
-- source=manual_default. 멱등: C1이 하나도 없는 브랜드에만 0을 넣음.
-- ============================================================================
insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, 'C1', 0, 'manual_default', 'seed:C1_zero'
from bcd_brands b
where not exists (
  select 1 from bcd_metric_values m where m.brand_id = b.id and m.metric_code = 'C1'
);
