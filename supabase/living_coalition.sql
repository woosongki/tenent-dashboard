-- 리빙 주제전: 연합(합동 주제전) 표시용 컬럼
-- 같은 지점 · 같은 주차 · 같은 coalition 값을 가진 팝업들 = 하나의 연합 주제전
-- (1행=1브랜드=1벤더 모델 유지, 실적은 브랜드별로 따로 입력)
alter table living_popup add column if not exists coalition text;

comment on column living_popup.coalition is '연합 주제전 명칭. 같은 지점·주차에서 동일 값이면 합동 주제전으로 묶어 표시';
