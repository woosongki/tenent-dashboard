# 노션 → Supabase 자동 동기화 설정

## 1. Notion Internal Integration 생성

1. https://www.notion.so/profile/integrations 접속
2. **+ New integration** 클릭
3. Name: `lifestyle-dashboard-sync`, Type: **Internal**
4. Workspace 선택 후 **Save**
5. **Internal Integration Token** 복사 (`secret_…`)

## 2. 3개 데이터베이스에 통합 연결

각 노션 DB 페이지를 열고 우상단 `···` → **Add connections** → 위에서 만든 통합 선택.

대상 DB:
- 😆 이랜드리테일 컨텐츠 유치 현황 (`cc900291-…`)
- 📊 상가 시세 데이터 (`cb159f2f-…`)
- 👨‍💼 업체리스트(F&B) (`b204fdd0-…`)

## 3. Vercel 환경변수 설정

Vercel 프로젝트 → Settings → Environment Variables에 추가:

| 변수명 | 값 | 환경 |
|---|---|---|
| `NOTION_API_KEY` | `secret_…` (1단계 토큰) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role | Production |
| `CRON_SECRET` | 랜덤 문자열 (예: `openssl rand -hex 32`) | Production |

선택 (기본값 사용 시 생략):
- `NOTION_DB_ATTRACTION` = `cc900291-4524-4a66-94d7-2a3373ade75d`
- `NOTION_DB_MARKET_PRICE` = `cb159f2f-8fcf-40fc-b5f2-18578260a412`
- `NOTION_DB_VENDOR_FNB` = `b204fdd0-3637-4ca0-8897-eca031ccf1e0`

## 4. 동작 방식

### 자동 동기화 (Vercel Cron)
- `vercel.json`의 `crons` 설정에 따라 매일 03:00 KST (= 18:00 UTC)에 자동 실행
- Vercel이 `Authorization: Bearer ${CRON_SECRET}` 헤더로 호출

### 수동 동기화
- 각 페이지(입점계획·상권분석·F&B 탭) 우측 상단 **"노션 동기화"** 버튼 클릭
- 로그인 사용자만 호출 가능

### 동기화 동작
- 노션 행을 100건씩 페이지네이션으로 모두 가져옴
- 시작 시점에 대상 테이블의 `notion_url → id` 맵을 1회 로드
- 각 노션 페이지에 대해 맵에 존재하면 UPDATE, 없으면 INSERT (앱-사이드 멱등 처리)
- DB에도 `notion_url` partial UNIQUE INDEX(NOT NULL 한정)가 걸려 있어 이중 안전망 — `supabase/attraction.sql`, `supabase/vendor_lease.sql` 참조
- 노션에서 삭제된 행은 Supabase에 잔존 (안전성 우선; 필요 시 수동 정리)

### 기존 중복 정리
운영 DB에 이미 중복이 쌓여 있다면 `supabase/attraction.sql`을 1회 실행. notion_url 기준으로 가장 오래된 1건만 남기고 나머지를 삭제한 뒤 partial UNIQUE INDEX를 건다 (멱등 — 여러 번 돌려도 안전).

## 5. 디버깅

```bash
# 로컬 개발에서 테스트
curl -X POST http://localhost:3000/api/sync/notion \
  -H "Content-Type: application/json"
```

응답 예시:
```json
{
  "ok": true,
  "duration_ms": 4521,
  "results": [
    { "table": "attraction_status", "fetched": 26, "upserted": 26, "errors": [] },
    { "table": "market_price_data", "fetched": 12, "upserted": 12, "errors": [] },
    { "table": "vendor_fnb", "fetched": 87, "upserted": 87, "errors": [] }
  ]
}
```
