-- ============================================================================
-- BCD 초기 시드 — 001_bcd_schema.sql 실행 후 적용
-- ============================================================================

-- ── 벤치마크 10개점 (PRD 07.1절 v1.0 확정) ─────────────────────────────────
insert into bcd_lists (list_type, version, name, match_strings, is_full_survey) values
  ('benchmark','v1.0','더현대서울',        array['더현대서울','더현대 서울','여의도IFC','현대백화점 여의도'], true),
  ('benchmark','v1.0','현대 송도',         array['현대프리미엄아울렛 송도','현대 송도','송도프리미엄아울렛'], true),
  ('benchmark','v1.0','용산아이파크몰',     array['아이파크몰','용산아이파크몰','용산 아이파크'], true),
  ('benchmark','v1.0','현대 김포',         array['현대프리미엄아울렛 김포','현대 김포','김포현대아울렛'], true),
  ('benchmark','v1.0','스타필드 하남',      array['스타필드하남','스타필드 하남'], true),
  ('benchmark','v1.0','롯데월드몰',        array['롯데월드몰','롯데월드타워','잠실 롯데월드몰'], true),
  ('benchmark','v1.0','타임스퀘어',        array['타임스퀘어','영등포 타임스퀘어'], true),
  ('benchmark','v1.0','스타필드 고양',      array['스타필드고양','스타필드 고양'], true),
  ('benchmark','v1.0','스타필드 수원',      array['스타필드수원','스타필드 수원'], true),
  ('benchmark','v1.0','스타필드 코엑스몰',   array['코엑스몰','스타필드 코엑스','코엑스'], true)
on conflict do nothing;

-- ── 초기 ruleset v1.0 (PRD 04.2절 초기 구간값. C2/C6 경계값은 임의값 — 파일럿 확정 전까지 사용) ──
insert into bcd_rulesets (version, is_active, definition, note) values (
  'v1.0',
  true,
  '{
    "base": [
      {"code":"C1","name":"벤치마크 유통 입점률","weight":20,"mid":10,"mode":"abs","t1":40,"t2":20,
       "unit":"%","note":"입점 점포 수 ÷ 전수조사 완료 점포 수 × 100. 분모는 bcd_lists(list_type=benchmark, is_full_survey=true) 건수"},
      {"code":"C2","name":"핫플 상권 입점 수","weight":20,"mid":10,"mode":"abs","t1":20,"t2":5,
       "unit":"개","note":"임의값 — 파일럿 실측 후 확정 필요(검토요청 #2 선행)"},
      {"code":"C3","name":"전국 매장 수","weight":10,"mid":5,"mode":"pct","t1":70,"t2":30,
       "unit":"개","note":"중분류 내 백분위. 표본 5건 미만이면 대분류로 확대(PRD 13.1절)"},
      {"code":"C4","name":"검색량 수준","weight":18,"mid":9,"mode":"pct","t1":70,"t2":30,
       "unit":"건/월","note":"네이버 검색광고 절대 검색수(PC+모바일). 데이터랩 상대지수 사용 금지"},
      {"code":"C5","name":"검색량 추세","weight":12,"mid":6,"mode":"pct","t1":70,"t2":30,
       "unit":"%","note":"전년 동월 대비. 첫 회차는 시계열 부족으로 N/A"},
      {"code":"C6","name":"매장 수 순증률","weight":10,"mid":5,"mode":"abs","t1":10,"t2":0,
       "unit":"%","note":"임의값 — 파일럿 실측 후 확정 필요. 첫 회차는 N/A"},
      {"code":"C8","name":"브랜드 감도","weight":10,"mid":5,"mode":"sel","t1":0,"t2":0,
       "unit":"","note":"상(10)/중(5)/하(0) 선택 또는 0~10 직접 입력. 부여 사유 필수"}
    ],
    "bonus": {"code":"C7","name":"온라인 채널 전개","weight":5,"mid":3,"mode":"abs","t1":3,"t2":1,
      "unit":"개","note":"brands.online_applicable=false면 미적용(해당없음), N/A 계산 제외"},
    "cuts": {"A":85,"Bp":70,"B":55,"C":40},
    "na_policy": {"max_na_points":25, "over_status":"미평가"},
    "pct_min_sample": 5
  }'::jsonb,
  '초기값. cuts는 파일럿 30건 실측 후 분위수로 재도출 예정(PRD 08.1절) — 그 전까지 임시값'
)
on conflict (version) do nothing;
