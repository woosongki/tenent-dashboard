# lifestyle 대시보드

이랜드리테일 컨텐츠팝업팀 내부 대시보드. 41개 점포(NC백화점·뉴코아아울렛·2001아울렛·동아백화점)의
매출·상권·테넌트 데이터를 기반으로 한 분석 도구 모음.

- **Next.js 16** (App Router, Turbopack) · **React 19** · **Tailwind v4**
- **Supabase** (인증·DB·Storage) · **Vercel** 배포
- 디자인: Neo-Brutalist (2~3px 검정 보더, 오프셋 그림자, Black Han Sans / JetBrains Mono)

> ⚠️ 이 프로젝트의 Next.js는 학습 데이터와 다른 16버전입니다. 코드 작성 전
> `node_modules/next/dist/docs/` 의 관련 가이드를 확인하세요 (`AGENTS.md` 참고).

---

## 주요 기능 (페이지)

| 경로 | 설명 |
|---|---|
| `/dashboard` | 메인 대시보드 |
| `/dashboard/sales` | 매출 분석 |
| `/dashboard/drilldown` | 채널·브랜드 드릴다운 |
| `/dashboard/branch/[storeId]` | 점포별 상세 (상권·인구·임대료) |
| `/dashboard/brand-fit` | **브랜드 적합도 진단** — 룰베이스 스코어링으로 입점 적합 점포 추천 |
| `/dashboard/brand-keyword` | 네이버 쇼핑 기반 브랜드 키워드 분석 |
| `/dashboard/verify` | **컨텐츠 검증** — DART 공시 + 뉴스 + Claude 분석 → Notion 브리프 |
| `/dashboard/homeplus` | 리테일 지도 (점포·경쟁사·체인 매장) |
| `/dashboard/calendar` | 52주 시즌 캘린더 / 팝업 배치 |
| `/dashboard/floorplans` | 점포 평면도 |
| `/dashboard/vacancy` | 공실 현황 |
| `/dashboard/goals` | 목표 관리 |
| `/dashboard/admin/users` | 사용자 승인 관리 (owner/admin) |

---

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # 아래 환경변수 채우기
npm run dev                         # http://localhost:3000
```

### 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm run lint` | ESLint |
| `npm run test` | 단위 테스트 (vitest, 1회 실행) |
| `npm run test:watch` | 테스트 watch 모드 |

---

## 환경변수 (`.env.local`)

### 필수 (앱 구동)
| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 (클라이언트) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (서버 전용) |

### 기능별 (해당 도구 사용 시)
| 키 | 사용처 |
|---|---|
| `ANTHROPIC_API_KEY` | 컨텐츠 검증(Claude 분석·SWOT) |
| `DART_API_KEY` | 컨텐츠 검증(전자공시 조회) |
| `NAVER_SEARCH_CLIENT_ID` / `NAVER_SEARCH_CLIENT_SECRET` | 브랜드 키워드·뉴스 검색 |
| `NOTION_API_KEY` | 검증 결과 Notion 저장 |
| `NOTION_DB_VERIFY_TENANT_ID` / `NOTION_DB_VERIFY_NEWS_ID` | 검증 Notion DB ID |
| `KAKAO_REST_API_KEY` | 매장 지오코딩(데이터 스크립트) |
| `DATA_GO_KR_POP_KEY` | 행정안전부 주민등록인구 |
| `SGIS_CONSUMER_KEY` / `SGIS_CONSUMER_SECRET` | 통계청 SGIS 생활인구 |
| `SEOUL_OPEN_API_KEY` | 서울 열린데이터광장 |

> `SUPABASE_SERVICE_ROLE_KEY` 등 서버 전용 키는 절대 클라이언트 코드에서 import 금지.

---

## 데이터 빌드 스크립트 (`scripts/`)

브랜드 적합도(`brand-fit`)와 지도에 쓰이는 정적 데이터(`src/data/*.json`)를 생성한다.
원본은 ERP 추출 데이터(`data/raw/`) 또는 외부 API.

| 스크립트 | 출력 | 원본 |
|---|---|---|
| `build-store-demographics.mjs` | store-demographics.json | ERP 연령대별 구매고객 |
| `build-store-sales.mjs` | store-sales.json | ERP 매출·객단가 |
| `build-store-categories.mjs` | store-categories.json | ERP 카테고리별 매출 |
| `build-store-brands.mjs` | store-brands.json | ERP 점포×브랜드 매출 |
| `build-store-areas.mjs` | store-areas.json | ERP 층별 전용면적 |
| `build-family-ratio.mjs` | (eland-meta 갱신) | 연령 비중 기반 가족비 추정 |
| `build-trade-area.mjs` | trade-area.json | 권역 + 소상공인 상가밀도(data.go.kr) |
| `fetch-*.mjs` | src/data/*.ts | Kakao Local API (체인 매장 좌표) |

실행 예: `node scripts/build-trade-area.mjs`

---

## 브랜드 적합도 스코어링

`src/lib/brand-fit/score.ts` — 41개 점포를 4개 축으로 채점 후 가중 평균(100점 만점).

- 가중치: **상권/고객층 50% · 인접앵커 20% · 브랜드성격 20% · 시너지 10%** (`WEIGHTS` 상수)
- 가중치를 바꾸면 진단 페이지의 "점수 산출 방식" 패널·결과표가 **자동 동기화**된다 (WEIGHTS export 사용).
- 회귀 테스트: `src/lib/brand-fit/score.test.ts` (`npm run test`)
  변별력(고유 점수 비율)·정렬·범위·결정론성 등 불변식 검증.

---

## 아키텍처 메모

- **인증**: `src/proxy.ts`가 모든 요청에서 Supabase 세션을 갱신. 페이지·API 접근 권한은
  각 layout/route에서 `getSessionContext()`로 체크.
- **세션 캐싱**: `getSessionContext`는 React `cache()`로 요청당 1회만 DB 조회 (egress 절감).
- **비용 보호**: 외부 유료 API 라우트는 `src/lib/rate-limit.ts`로 레이트 리밋.
- **에러 처리**: `(dashboard)/error.tsx`, `not-found.tsx`, `global-error.tsx`.
- **Supabase egress 절감**: 평면도는 썸네일 lazy-load, `<img>` 직접 사용(next/image 미적용은 의도).
