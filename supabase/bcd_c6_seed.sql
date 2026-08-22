-- ============================================================================
-- C6 매장 수 순증률 — 전 브랜드 기본 중간값(5%)로 우선 세팅.
-- 적용: bcd_brands_seed.sql 실행 후. source=manual_default.
-- C6는 abs(t1=10,t2=0) — value 5 → '중'(5점). 첫 수집엔 직전 회차가 없어 순증률을
--   계산할 수 없어, 그동안 이 기본값이 점수로 쓰인다.
-- 이후 카카오 2회차부터 실제 순증률이 최신값으로 기록되어 자동 대체된다.
-- 멱등: 같은 브랜드에 manual_default C6이 있으면 건너뜀.
-- ============================================================================
insert into bcd_metric_values (brand_id, metric_code, value, source, checked_by)
select b.id, 'C6', 5, 'manual_default', 'seed:C6_default'
from bcd_brands b
where not exists (
  select 1 from bcd_metric_values m
  where m.brand_id = b.id and m.metric_code = 'C6' and m.source = 'manual_default'
);
