# MCP 서버 셋업 — 새 Claude Code 계정용

이 프로젝트에서 활용 중인 MCP(Model Context Protocol) 서버 4종.
새 구글계정에서 Claude Code 로그인 후 아래 순서대로 재연결하세요.

총 소요: **약 10분**

---

## 1. Supabase MCP ⭐ (DB 직접 조작)

### 용도
- `execute_sql` — SQL 직접 실행 (마이그레이션 외 데이터 조회)
- `apply_migration` — DDL/마이그레이션 적용
- `list_tables` — 스키마 조회
- `get_logs` / `get_advisors` — 디버깅

### 필요 정보
- **Project Ref**: `arxpepynyenotpgjkazq` (이 프로젝트)
- **Personal Access Token (PAT)**:
  - 새로 받기: https://supabase.com/dashboard/account/tokens
  - **"Generate new token"** → name: `claude-code` → Generate
  - 토큰은 한 번만 보임 → 안전한 곳에 임시 저장

### 연결
Claude Code에서:
```
/mcp
```
→ Supabase 선택 → PAT 입력 → 완료.

또는 `~/.claude/mcp.json` 직접 작성:
```json
{
  "supabase": {
    "command": "npx",
    "args": [
      "-y",
      "@supabase/mcp-server-supabase@latest",
      "--access-token",
      "YOUR_PAT_HERE",
      "--project-ref",
      "arxpepynyenotpgjkazq"
    ]
  }
}
```

### 동작 확인
```
list_tables 로 public 스키마 보여줘
```

---

## 2. Notion MCP

### 용도
- `notion-search` — 워크스페이스 페이지/DB 검색
- `notion-fetch` — 특정 페이지/DB 상세 조회
- `notion-update-page` — 페이지 수정 (선택)

### 필요 정보
- **Notion Internal Integration Token**:
  - https://www.notion.so/profile/integrations 접속
  - 기존 통합 사용 또는 **"+ New integration"**:
    - 이름: `claude-code`
    - Workspace: 이랜드리테일 워크스페이스
    - Capabilities: Read content (최소) / Update content (선택)
  - 발급된 **Internal Integration Secret** 복사

### Notion 워크스페이스 권한
새 integration이 사용할 페이지/DB 에 **연결 허용**:
- 노션 워크스페이스에서 대상 페이지 우측 상단 `...` → **연결 → claude-code 추가**
- 또는 데이터베이스 단위로 추가
- 우리가 자주 보는 DB:
  - 이랜드리테일 컨텐츠 유치 현황 (attraction)
  - 업체리스트 F&B
  - 상가 시세 데이터 (vendor_lease)
  - 팝업 컨텍판
  - 52주 캘린더

### 연결
```
/mcp
```
→ Notion 선택 → Integration Token 입력.

또는 `~/.claude/mcp.json`:
```json
{
  "notionApi": {
    "command": "npx",
    "args": ["-y", "@notionhq/notion-mcp-server"],
    "env": {
      "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer YOUR_NOTION_TOKEN\", \"Notion-Version\": \"2022-06-28\"}"
    }
  }
}
```

### 동작 확인
```
노션에서 "팝업 컨텍판" 검색해줘
```

---

## 3. Vercel MCP

### 용도
- 배포 상태 / 로그 / 런타임 에러 조회
- 도메인 / 환경변수 관리

### 필요 정보
- **Vercel Access Token**:
  - https://vercel.com/account/tokens
  - **Create Token** → 권한: Full / Scope: 본인 계정
  - 토큰 복사

### 연결
```
/mcp
```
→ Vercel 선택 → Token 입력.

또는 `~/.claude/mcp.json`:
```json
{
  "vercel": {
    "command": "npx",
    "args": ["-y", "@vercel/mcp-adapter"],
    "env": {
      "VERCEL_API_TOKEN": "YOUR_VERCEL_TOKEN"
    }
  }
}
```

### 동작 확인
```
list_deployments 최근 5건 보여줘
```

---

## 4. Claude in Chrome 확장 (스크린샷·페이지 검증)

### 용도
- 배포된 페이지를 Claude가 직접 스크린샷
- DOM 상호작용 (클릭/입력) 가능
- UI 디자인 검증에 매우 유용

### 설치
1. https://claude.ai/chrome 접속 → Chrome 확장 설치
2. **새 구글계정으로 Chrome 로그인** (또는 Chrome 프로필 분리)
3. 확장 클릭 → Claude 로그인

### 사용
Claude Code에서:
```
mcp__Claude_in_Chrome__navigate 로 https://gana-phi.vercel.app 열고 스크린샷 줘
```

---

## 5. (선택) k-skill-proxy / 기타

이 프로젝트는 위 4개 외에 별도 MCP 서버는 없습니다. 추가로 필요하면:
- **Kakao Developers MCP** — (공식 없음, REST API 직접 호출로 충분)
- **공공데이터포털 MCP** — (공식 없음, 직접 호출)

---

## ⚠ 주의 — 자주 발생하는 문제

| 문제 | 원인 | 해결 |
|---|---|---|
| Supabase MCP "Permission denied" | PAT 만료 또는 권한 부족 | 새 PAT 발급, Full access |
| Notion "page not found" | Integration이 해당 페이지에 연결 안 됨 | 워크스페이스에서 페이지 우측 `...` → 연결 추가 |
| Vercel MCP "401" | 토큰 만료 | 새 토큰 발급 후 mcp.json 갱신 |
| Claude in Chrome "disconnected" | 확장 비활성 | Chrome 재시작, 확장 다시 로그인 |
| `/mcp` 명령 없음 | Claude Code 버전 낮음 | `npm i -g @anthropic-ai/claude-code@latest` |

---

## 📋 새 계정 첫 셋업 순서

1. **Claude Code 로그인**: `claude /login` → 새 구글계정 인증
2. **Supabase MCP**: PAT 발급 → `/mcp`로 연결
3. **Notion MCP**: Integration 생성 + 워크스페이스 페이지 연결 → `/mcp`로 연결
4. **Vercel MCP**: 토큰 발급 → `/mcp`로 연결
5. **Chrome 확장**: 새 구글계정 Chrome 로그인 → 확장 재로그인
6. **프로젝트 열기**: `cd C:\Users\woo_songki\Desktop\gana && claude`
7. **첫 메시지**:
   ```
   HANDOVER.md, AGENTS.md 읽고 프로젝트 상태 파악해줘
   ```

→ 약 10~15분 안에 이전 Claude와 동일한 작업 환경 완성.

---

## 🆘 환경변수 / 시크릿 관리

각 MCP 서버에 입력한 토큰은 `~/.claude/mcp.json` 또는 `~/.config/claude/mcp.json` 에 저장됩니다 (OS별 다름).

`.env.local` 의 환경변수는 **MCP 와 별도** — 프로젝트 내 코드에서 사용:
```bash
# .env.local 예시 (HANDOVER.md §4 참조)
SUPABASE_SERVICE_ROLE_KEY=...
KAKAO_REST_API_KEY=...
DATA_GO_KR_POP_KEY=...
SEOUL_OPEN_API_KEY=...
NOTION_API_KEY=...
```

두 곳 모두 본인 키로 채워야 정상 작동.
