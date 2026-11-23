-- ============================================================================
-- 가전을 대분류로 분리 (2026-11 요청).
--   리테일·기타 / 가전·전자  →  가전·전자 / 가전·전자
-- 중분류명은 그대로 → 가전 브랜드끼리의 백분위 비교군(category_minor:가전·전자)은 불변.
--
-- ⚠ 영향: 리테일·기타의 다른 중분류 중 표본이 pct_min_sample(5) 미만인 곳은 대분류
--   '리테일·기타' 전체와 비교되는데, 그 비교군에서 가전 브랜드가 빠진다.
--   → 해당 브랜드의 C3·C4 백분위 점수가 바뀔 수 있다. 아래 1)로 해당 여부를 먼저 확인.
-- 멱등: 이미 옮겨졌으면 0행 갱신.
-- ============================================================================

-- 1) 사전 확인: 리테일·기타 중분류별 활성 브랜드 수 (5 미만이면 대분류 비교 대상)
select category_minor, count(*) filter (where scope_status = 'active') as active_brands
from bcd_brands
where category_major = '리테일·기타'
group by category_minor
order by category_minor;

-- 2) 이동
update bcd_brands
set category_major = '가전·전자'
where category_major = '리테일·기타' and category_minor = '가전·전자';

-- 3) 결과 확인
select name, category_major, category_minor, scope_status
from bcd_brands
where category_minor = '가전·전자'
order by name;
