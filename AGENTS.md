<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-standards (모델 무관 품질 기준 — Opus/Sonnet도 이 블록을 따르면 동일 품질) -->
# lifestyle 대시보드 — 작업 표준

## 대화·보고
- 답변은 한국어, **결론부터**. 과정 나열보다 "무엇이 어떻게 됐고, 사용자가 뭘 확인/조치해야 하는지".
- 제안은 **번호를 붙여** 제시하고(사용자가 번호로 지시함), 한 번 붙인 번호는 대화 중 바꾸지 않는다.
- 사용자가 문제를 설명하거나 질문하면 **진단 보고가 결과물** — 고치라고 하기 전에 코드를 바꾸지 않는다.
- 완료 보고에는 반드시: 커밋 해시 · 항목별 변경 요약 · 배포 후 확인 포인트 · 수동 조치(SQL/env/로컬 스크립트).

## 검증 체인 (커밋 전 필수, 순서대로)
`npx tsc --noEmit` → 변경 파일만 `npx eslint <files>` (전체는 기존 경고로 실패) → `npm run build` → `npx vitest run`

## Git
- 작업 브랜치는 `claude/...`, main 반영은 **스쿼시 머지**. 머지 후 반드시
  `git checkout -B <branch> origin/main` + `--force-with-lease` 푸시로 재동기화 (안 하면 다음 푸시 꼬임).
- non-fast-forward 거절 시: 원격 커밋이 main에 스쿼시 머지된 이력인지 확인 후에만 force-with-lease.
- PR은 사용자가 요청할 때만. 커밋 메시지는 한국어 "무엇을 왜".
- `data/stores/*.json` 등 압축 한 줄 포맷은 재직렬화 금지 — 문자열 치환으로 최소 diff.

## 디자인 (Neo-Brutalist — 새 UI는 무조건 이 토큰)
- 테두리 `border-[2px]`/`border-[3px]` `border-[#0a0a0a]`, 그림자 `shadow-[3px_3px_0_0_#0a0a0a]`, 라운드 없음.
- 강조 `bg-yellow-300`, 배경 `#FAF7EC`/`#F1ECDB`, 위험 rose, 데이터 숫자는 `font-mono tabular-nums`.
- 기존 페이지의 Section/Stat/PageHeader/EmptyState 컴포넌트를 재사용하고 새로 만들지 않는다.

## 도메인 함정 (틀리기 쉬운 것)
- **일평당매출**: `area_raw` = 면적×일수(ERP가 30일 고정으로 구움). 면적 복원은 ÷30, 일평당 분모는
  실제 경과일수 N(`sales_offline_month_meta.days`, 없으면 30). 당월 파일은 월 중간 스냅샷일 수 있다.
- **'그외' 브랜드**(엠페스트·문화센터·소극장( 등, `isOthersBrand`)는 본 수치·제안에서 제외.
- **제안 브랜드는 외부 시장에서** — 이랜드 보유 브랜드(스파오·미쏘·모던하우스 등)를 제안하지 않는다.
- **RLS**: anon key는 공개다. 페이지 role 게이트는 UI일 뿐 — 쓰기 보호는 RLS/RPC(security definer)로.
- 매출 실테이블 쓰기는 staging→`swap_sales_from_staging` RPC 경유만(비원자적 delete→insert 금지).
- 공공 API: uddi 월마다 갱신 / returnType=JSON 넣으면 빈 응답 / 원격 환경은 외부 API 프록시 403 → 로컬 실행 안내.

## 보안·비용
- 시크릿 값은 응답·커밋 어디에도 노출 금지. 채팅에 노출되면 재발급 권고.
- LLM 호출 기능은 온디맨드(버튼) + owner/admin 게이트 + rateLimit 기본. API 라우트는 `requireApproved`/`requireRole` 가드 사용.
- 파괴적 작업(테이블 삭제, 파일 삭제, 강제 푸시)은 근거 확인 후, 애매하면 사용자에게 먼저.

## 스킬
- 개선 분석/실행: `.claude/skills/improve` · 커밋/머지: `ship` · 수치 검증: `verify-metric` · 데이터 수집 디버그: `data-doctor`
<!-- END:project-standards -->
