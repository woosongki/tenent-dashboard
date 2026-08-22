-- ============================================================================
-- C8 브랜드 감도 — 전 브랜드 기본값 5(중)로 우선 세팅.
-- 적용: bcd_brands_seed.sql 실행 후. source=manual_default.
-- 멱등: 같은 브랜드에 manual_default C8이 있으면 건너뜀. 이후 콘솔에서 개별 조정 가능.
-- ============================================================================
insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, 'C8', 5, 'manual_default', 'seed:C8_default'
from bcd_brands b
where not exists (
  select 1 from bcd_metric_values m
  where m.brand_id = b.id and m.metric_code = 'C8' and m.source = 'manual_default'
);
