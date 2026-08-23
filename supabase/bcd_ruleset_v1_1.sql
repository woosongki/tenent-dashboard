-- ============================================================================
-- BCD ruleset v1.1 — C1 구간(band) 채점 + C2 배점 재조정.
--   C1: 4곳↑(40%)=25 · 2~3곳(20%)=20 · 1곳(10%)=10 · 0곳=0 (mode=band, weight 25).
--   C2: 20→15 (기본 배점 합 100 유지). 나머지 동일.
-- 활성 ruleset은 1개 — 기존 비활성화 후 v1.1 활성 삽입. 과거 평가 이력은 보존(소급 안전).
-- 멱등: v1.1이 이미 있으면 건너뜀.
-- ============================================================================
update bcd_rulesets set is_active = false where is_active;

insert into bcd_rulesets (version, is_active, definition, note)
select 'v1.1', true, '{"base":[{"code":"C1","name":"벤치마크 유통 입점률","weight":25,"mid":20,"mode":"band","t1":40,"t2":20,"unit":"%","note":"입점 유통수 기준 구간: 4곳↑(40%)=25 · 2~3곳(20%)=20 · 1곳(10%)=10 · 0곳=0","bands":[{"min":40,"score":25},{"min":20,"score":20},{"min":10,"score":10}]},{"code":"C2","name":"핫플 상권 입점 수","weight":15,"mid":8,"mode":"abs","t1":20,"t2":5,"unit":"개","note":"배점 재조정(C1 25로 상향분 5 흡수). 경계값은 파일럿 후 확정."},{"code":"C3","name":"전국 매장 수","weight":10,"mid":5,"mode":"pct","t1":70,"t2":30,"unit":"개","note":"중분류 내 백분위. 표본 5건 미만이면 대분류로 확대(PRD 13.1절)"},{"code":"C4","name":"검색량 수준","weight":18,"mid":9,"mode":"pct","t1":70,"t2":30,"unit":"건/월","note":"네이버 검색광고 절대 검색수(PC+모바일). 데이터랩 상대지수 사용 금지"},{"code":"C5","name":"검색량 추세","weight":12,"mid":6,"mode":"pct","t1":70,"t2":30,"unit":"%","note":"전년 동월 대비. 첫 회차는 시계열 부족으로 N/A"},{"code":"C6","name":"매장 수 순증률","weight":10,"mid":5,"mode":"abs","t1":10,"t2":0,"unit":"%","note":"임의값 — 파일럿 실측 후 확정 필요. 첫 회차는 N/A"},{"code":"C8","name":"브랜드 감도","weight":10,"mid":5,"mode":"sel","t1":0,"t2":0,"unit":"","note":"상(10)/중(5)/하(0) 선택 또는 0~10 직접 입력. 부여 사유 필수"}],"bonus":{"code":"C7","name":"온라인 채널 전개","weight":5,"mid":3,"mode":"abs","t1":3,"t2":1,"unit":"개","note":"brands.online_applicable=false면 미적용(해당없음), N/A 계산 제외"},"cuts":{"A":85,"Bp":70,"B":55,"C":40},"na_policy":{"max_na_points":25,"over_status":"미평가"},"pct_min_sample":5}'::jsonb,
       'C1 구간채점(4곳25/2~3곳20/1곳10) + C2 20→15'
where not exists (select 1 from bcd_rulesets where version='v1.1');
