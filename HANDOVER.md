# HANDOVER.md — 프로젝트 인수 메모

> **새 Claude Code 세션에서 이 파일을 먼저 읽어 주세요.**
> AGENTS.md 와 함께 프로젝트 컨텍스트를 5분 안에 따라잡을 수 있습니다.

마지막 갱신: 2026-07-05

---

## 1. 프로젝트 정체성

- **이름**: lifestyle 대시보드 (이랜드리테일 컨텐츠 운영)
- **목적**:
  - 사내 컨텐츠팝업팀의 일상 운영 도구 (매출·입점·팝업·공실 추적)
  - 임원 보고용 자료 생성 (PDF/스크린샷)
- **사용자**: 사내 운영팀 소수 + 임원 보고 시점
- **owner**: pooh3171@gmail.com

### 기술 스택
| 영역 | 기술 |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19 + Tailwind v4 + Black Han Sans + JetBrains Mono |
| DB / Auth | Supabase (RLS 기반) |
| 배포 | Vercel |
| 차트 | recharts |
| Toast | sonner |
| 외부 API | Kakao Maps / 행안부 / 서울 / 노션 / k-skill-proxy |

⚠️ **Next.js 16은 브레이킹 변경이 많습니다**. 코드 작성 전 `node_modules/next/dist/docs/` 참고 (AGENTS.md 참조).

---

## 2. 디자인 시스템 — Neo-Brutalist (변경 시 주의)

### 핵심 원칙
- 검정 2~3px 테두리 + offset shadow (3~6px)
- 둥근 모서리 없음 (`rounded-*` 클래스 거의 안 씀)
- 큰 한국어 헤드라인은 **Black Han Sans** (`.font-display`)
- KPI 숫자는 **JetBrains Mono** + tabular-nums + ExtraBold
- paper-soft (`#F1ECDB`) / yellow-300 / violet-500 / cyan-400 / rose-500 액센트
- 형광 컬러는 평소 톤, **"임원 모드" 토글**(Report 버튼)로 paper-soft + yellow-100 톤다운

### 결정 근거
- 보고 시 가시성↑ (큰 숫자 + 강한 대비)
- "lifestyle 대시보드"라는 정체성을 시각적으로 박기
- 일반 SaaS 어드민 톤은 의도적으로 피함

### 유틸리티 클래스 (globals.css 정의)
- `.brutal` / `.brutal-sm` / `.brutal-lg` — 카드 wrapper
- `.brutal-hover` — translate + shadow lift
- `.chip-teal/magenta/yellow/violet/ink` — 액센트 칩 배경
- `.font-display` / `.font-mono` — 폰트 패밀리

### 디자인 토큰 (`src/lib/tokens.ts`)
- `TYPO.pageTitle/sectionTitle/kpiNumber/...`
- `SPACE.pageX/pageY/sectionGap/pageMaxW`
- `ELEVATION.flat/card/raised/popover`

→ **새 페이지/컴포넌트 만들 때 반드시 이 토큰 사용**.

---

## 3. 사이드바 7개 메뉴 — 각 페이지의 데이터 소스

| 사이드바 | 경로 | 핵심 lib / 데이터 |
|---|---|---|
| 대시보드 | `/dashboard` | `lib/dashboard/queries.ts` (Supabase aggregate) |
| 매출분석 | `/dashboard/sales` | Supabase `sales_offline_*`·`sales_online_*` (관리→매출 데이터 갱신에서 xlsx 업로드) |
| 입점계획(26년) | `/dashboard/drilldown` | `attraction_status` 테이블 + 노션 sync |
| 공실해결 | `/dashboard/vacancy` | `data/vacancy.json` (CSV 변환 정적) |
| 컨텐츠 풀 | `/dashboard/goals` | `goals` + `vendor_fnb` + `vendor_lease` + `popup-contacts.json` |
| 52주 캘린더 | `/dashboard/calendar` | `calendar52_weeks` 테이블 + 노션 매핑 |
| 전점도면 | `/dashboard/floorplans` | Supabase Storage (`floorplans` bucket) |
| 상권분석 | `/dashboard/branch` | `lib/stores.ts` + `lib/tradeArea.ts` + `lib/realEstate.ts` + `lib/congestion/seoul.ts` |
| 사용자 관리 | `/dashboard/admin/users` | `profiles` + `organization_members` (RLS) |

### 점포 마스터 (`data/stores/stores.json`)
- 41개 점포 (NC백화점·뉴코아아울렛·2001아울렛·동아백화점)
- 카카오 geocoding 결과 (`lat/lng/bcode/lawdCd/region1/2/3`)
- 갱신: `scripts/geocode-stores.mjs` (KAKAO_REST_API_KEY 필요)

---

## 4. 외부 API / 환경변수 — `.env.local`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://arxpepynyenotpgjkazq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Kakao (지도 JS + REST 지오코딩)
NEXT_PUBLIC_KAKAO_JS_KEY=...
KAKAO_REST_API_KEY=...

# 국토부 상업용 부동산 실거래가 (proxy — 별도 키 X)
KSKILL_PROXY_BASE_URL=https://k-skill-proxy.nomadamas.org

# 공공데이터포털 — 행안부 인구 (상권분석 ④번)
DATA_GO_KR_POP_KEY=...

# 서울 열린데이터광장 — 실시간 도시데이터 (상권분석 ③번)
SEOUL_OPEN_API_KEY=...

# 노션 통합 (입점계획/F&B/임대 sync)
NOTION_API_KEY=...
NOTION_DB_ATTRACTION_ID=...
NOTION_DB_VENDOR_FNB_ID=...
NOTION_DB_VENDOR_LEASE_ID=...

# CRON 보호 (POST /api/sync/notion)
CRON_SECRET=...

# (백업, 사용 X) SGIS+ — 권한 문제로 미사용
SGIS_CONSUMER_KEY=...
SGIS_CONSUMER_SECRET=...
```

### Vercel 배포 시
- 위 환경변수를 Vercel 대시보드 → Settings → Environment Variables 에도 동일하게 추가

---

## 5. 진행 상황 (2026-05-12 기준)

### 완료
- ✅ Neo-Brutalist + Black Han Sans 디자인 시스템 전면 적용
- ✅ 사이드바 메뉴별 페이지 톤앤매너 통일 (1번~10번)
- ✅ 임원 모드 토글 (formal Report 버튼)
- ✅ A+B 인증 게이트 (Supabase 가입 비활성화 + `is_approved` 워크플로)
- ✅ 상권분석 ① **1km 임차료** (매매가 → 자본환원율 5.5% 환산)
- ✅ 상권분석 ③ **서울 실시간 혼잡도** (7개 점포, 5분 갱신)
- ✅ 6개 점포 geocoding 보강 (평택/울산/광명/창원/일산/동수원)
- ✅ 이식 패키지 추출 (`scripts/export-branch-module.mjs`)

### 진행 중 / 대기
- ⏸ 상권분석 ④ **행정동 인구 분포** — 행안부 API 키 활성화 대기 중 (1~3시간)
  - 활성화 후 `node scripts/fetch-population.mjs` 재실행 → `src/data/population.json` 생성
  - 그 후 [storeId]/page.tsx 에 "행정동 인구·연령 분포" 섹션 추가 필요
- ⏸ 상권분석 ② **비어있는 카테고리 + 제안 브랜드** — 카테고리 매핑 정의 필요
  - 사용자 7개 카테고리(잡화/캐주얼/여성/신사/스포츠/아동/라이프스타일)와 `attraction_status.category` 매핑
  - 의류 4종(여성/신사/캐주얼)의 데이터 소스 미확정

### TODO 후순위
- 비서울 점포 시간대별 유동인구 (한국관광공사 TourAPI 4.0)
- 표/차트의 PDF/PNG 내보내기 ("코드 이식" 아닌 보고용 export)

---

## 6. 한 번 만든 도구 — 재사용 가능

```
scripts/
├─ export-branch-module.mjs       # 상권분석 코드 이식 ZIP 만들기
├─ geocode-stores.mjs             # 점포 마스터 갱신 (raw → stores.json)
├─ fetch-trade-area.mjs           # 상권 분석 정적 데이터 (소상공인 API)
├─ fetch-population.mjs           # 행안부 인구 (활성화 대기 후)
├─ import-seoul-hotspots.mjs      # 서울 121장소 xlsx → JSON
├─ import-calendar52.mjs          # HTML → 캘린더 JSON
├─ import-popup-contacts.mjs      # CSV → 팝업 컨텍판 JSON
├─ import-vacancy.mjs             # CSV → 공실 데이터 JSON
├─ seed-calendar52.mjs            # 캘린더 DB 시드
└─ living-popup-daily.mjs         # 리빙 일매출 변환·import·미매치 리포트 (--convert/--dry/--report)
```

※ 2026-07 정리: build-sales.mjs(앱 내 업로드로 대체)·debug-sgis.mjs(일회성 진단) 삭제,
   리빙 일매출 3종(convert/import/report)은 living-popup-daily.mjs 하나로 병합.

각 스크립트는 `.env.local` 자동 로드. 필요 환경변수는 코드 상단에 명시되어 있음.

---

## 7. 알려진 한계 / 결정 사항

| 영역 | 한계 / 결정 |
|---|---|
| **임차료** | 정부 공개 API에 임대 데이터 없음 → 매매가 × 자본환원율 5.5% 환산 추정 |
| **서울 혼잡도** | 121개 핫스팟 권역만 — 서울 외 점포는 fallback X |
| **인구 데이터** | SGIS+ Plus 권한 문제로 행안부 OpenAPI 사용 (행정동 단위) |
| **3km 반경** | 좌표 변환(UTM-K → WGS84) 필요해서 현재는 "행정동 단위" 매칭으로 단순화 |
| **카카오 지도** | next.config CSP `script-src`/`connect-src` 에 카카오 도메인 명시 필요 |

---

## 8. 정기 운영 작업

| 빈도 | 작업 |
|---|---|
| 월 1회 | `node scripts/fetch-population.mjs` (행안부 인구 갱신) |
| 주 1회 | `node scripts/fetch-trade-area.mjs` (상권 데이터 갱신) |
| 필요 시 | `POST /api/sync/notion` (`CRON_SECRET` Bearer) — 노션 데이터 sync |
| 매출 갱신 시 | 앱 내 **관리 → 매출 데이터 갱신**(`/dashboard/admin/sales`)에서 ERP xlsx 4개(5·6·8·9) 업로드 → 파싱 로직은 `src/lib/sales/ingest.ts` |
| CSV 업로드 시 | `import-vacancy.mjs` / `import-popup-contacts.mjs` |

---

## 9. 새 Claude를 위한 핵심 한 줄

> "**HANDOVER.md → AGENTS.md → 최근 git log 5개** 순서로 읽고 시작하세요. 디자인 시스템은 Neo-Brutalist이고, 이걸 바꾸면 안 됩니다(이미 10페이지 통일 완료). 새 기능은 `src/lib/tokens.ts`의 토큰을 반드시 사용하세요."

### 첫 작업 명령어 권장
```bash
git log --oneline -10              # 최근 변경
git status                          # 미커밋 상태
npx tsc --noEmit                    # 타입 에러
ls scripts/                         # 사용 가능한 운영 스크립트
```

---

## 10. 인수인계 후 가장 흔히 묻는 질문

**Q. 사이드바 6번 (52주 캘린더)의 popup 매칭이 빨간 박스로 떴어?**  
A. 컨텍판 자동 매칭. `lib/calendar52.ts` 의 `buildPopupMatches` 가 popup 텍스트 안에서 컨텍판 브랜드명 찾아 표시. 색상은 단계별 톤.

**Q. 임원 모드(Report 버튼) 누르면 톤이 약해지는데 의도?**  
A. 의도. 형광이 강해서 PDF/투사 시 부담스럽다는 피드백 → CSS `.mono` 클래스로 paper-soft + yellow-100 으로 자동 다운.

**Q. 점포 1차상권 임대료는 신뢰할 만한가?**  
A. 자본환원율 5.5% 가정. 실시장 임대료와 차이 가능. UI에 "추정값" 캡션 명시. 정확한 수치는 직접 부동산 문의.

**Q. 인증 게이트는 어떻게 동작?**  
A. Supabase 회원가입 차단 + `profiles.is_approved` 플래그. 로그인하면 layout에서 미승인자는 `/pending-approval` 격리. `/dashboard/admin/users` 에서 owner/admin 만 승인 처리.

---

## 11. 배포 전 필수 조치 (매출 파이프라인 v2 · 인증 · 의존성)

이번 버전업에서 코드만으로 끝나지 않는 조치 3가지. **순서대로** 처리.

### ① 매출 적재 — 현행: 서버 액션(service_role) 방식 (2026-07 정리)
매출 적재는 **관리 → 매출 데이터 갱신**에서 브라우저 파싱 후 `commitSalesChunk` 서버 액션
(service_role, owner/admin 재검증)으로 적재한다. 실 매출 테이블 RLS는 service_role 쓰기만 허용으로
하드닝돼 있어 anon key 로는 쓰기 불가.
- `supabase/sales_ingest_v2.sql`(staging/swap RPC)은 DB에 적용돼 있으나 **현행 적재 경로는 사용하지 않음**
  (브라우저 직접쓰기 시절의 원자적 교체 장치). RPC·staging 테이블은 무해하며, 서버 액션에
  원자적 스왑을 다시 원하면 재활용 가능. 현행 서버 액션은 삭제→청크 삽입이라 중간 실패 시 재업로드 필요.
- 당월 파일의 실제 영업일수는 파일 시트명/상단에 **"N일누적"** 표기를 넣으면 자동 파싱되어
  행별 `days` 컬럼으로 저장 → 일평당 분모에 반영(미표기 시 그 달 말일 기준).
- ⚠ 전년/당년 **평당 시트의 면적 컬럼 단위가 서로 다르면** 일평당매출 성장율이 그 배율만큼 튄다
  (실사례: 전년 시트가 10배 → 성장율 10배 부풀림). 튀면 두 시트 단위부터 대조.

### ② xlsx 취약점 — 로컬에서 SheetJS 정식판으로 교체 (권장)
`xlsx@0.18.5` 는 npm 배포본에 고위험 취약점(Prototype Pollution·ReDoS)이 있고 **npm 상엔 패치가 없음**(SheetJS가 자체 CDN으로 이전). 원격 실행 환경은 그 CDN(cdn.sheetjs.com)이 프록시에 막혀 여기서 교체 불가 → **로컬/CI에서** 아래 실행:

```bash
npm rm xlsx
npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz   # 동일 API, 드롭인 교체
npm run build && SALES_FIXTURE_DIR=<xlsx폴더> npx vitest run src/lib/sales/ingest.test.ts
```
- API가 동일해 코드 수정 불필요. 커밋으로 package.json/lock 반영.
- 잠정 완화: 업로드·매출 적재 경로는 이번에 owner/admin+승인 게이트로 좁혀 실사용 공격면은 축소됨(①③).

### ③ 참고 — 프레임워크 취약점(미조치)
`npm audit` 에 Next.js 16.2.4 관련 high 권고가 있으나, 본 프로젝트는 커스터마이즈된 Next 를 **의도적으로 핀**(AGENTS.md)해 두어 자동 bump 하지 않았음. 프레임워크 업그레이드는 별도 검증 후 진행 권장. `ws` high 는 이번에 8.21.0 으로 패치 완료.

### 인증 가드 통일 (코드, 자동 반영)
API 라우트 인증을 `src/lib/auth/guards.ts`(`requireUser`/`requireApproved`/`requireRole`)로 통일. 이전엔 승인(`is_approved`) 체크가 대시보드 레이아웃에만 있어 미승인 유저가 API(네이버·DART·Notion 등)를 직접 호출 가능했음 → 이제 각 라우트에서 차단.

---

## 12. 버전업 배치 2 (상권 데이터원 · 성능 · 자동수집 · CI)

### 상권분석 카테고리 비중 소스 전환 (#2)
`getCategoryGap` 이 정적 JSON 대신 소스를 고를 수 있게 됨.
- 기본: `store-categories.json`(ERP 2026-04 정적) → **무설정 시 기존과 동일**.
- 전환: Vercel 환경변수 **`BRANCH_CATEGORY_SOURCE=supabase`** 설정 시 `sales_offline_month` 최신월에서 카테고리 비중을 파생 → 매출 갱신을 따라감. 기준월 라벨(‘최신 반영’)도 자동.
- 안전장치: ERP 복종→10카테고리 매핑 커버리지가 낮은 점포는 자동으로 static 폴백(상권분석 숫자가 조용히 틀어지지 않음). 처음 켤 때 몇 개 점포 카테고리 갭이 static 과 유사한지 눈으로 대조 권장.

### 상권분석 페이지 성능 (#4)
직렬 `await` 를 `Promise.all` 2단계로 병렬화(실거래가·혼잡도·카테고리갭 동시). 외부 API(realEstate 8s·congestion 6s)에 `AbortSignal.timeout` 추가 → 느린 공공 API가 페이지 전체를 잡지 않음(실패 시 해당 섹션만 생략).

### 데이터 정기 수집 (#7) — `.github/workflows/data-refresh.yml`
로컬 수동 실행하던 수집 스크립트를 월 1회 스케줄 + 수동 트리거로 자동화, 변경분을 PR 로 올림. **필요 시크릿**: `KAKAO_REST_API_KEY`(체인 좌표), `DATA_GO_KR_POP_KEY`(인구), `SBIZ_API_KEY`(상권). 저장소 Settings → Secrets 에 등록해야 동작.

### 품질 CI (#8) — `.github/workflows/ci.yml`
PR·push 마다 typecheck + vitest + build 실행(lint 는 기존 경고 때문에 advisory). 테스트 추가: `retailCategories`(복종 매핑)·`categoryGap`(빈 카테고리 판정)·`salesLogic`(dedupe·그외 브랜드). vitest 는 `server-only` 를 스텁 alias 처리해 서버 로직도 단위 테스트 가능(기존에 깨져 있던 `brand-fit/score.test` 도 이때 함께 복구).

---

## 부록 A. MCP 서버 재연결

새 Claude 계정으로 작업 시 `.claude/MCP_SETUP.md` 참조.

## 부록 B. 자주 쓰는 권한

`.claude/settings.json` 에 미리 등록되어 있어 새 계정에서도 그대로 동작.
