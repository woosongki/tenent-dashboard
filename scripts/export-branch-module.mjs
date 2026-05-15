/* eslint-disable no-console */
/**
 * 상권분석 모듈을 다른 Next.js 프로젝트로 이식할 수 있는 패키지로 추출.
 *
 * 출력: dist/branch-export/  (사용자가 ZIP으로 묶어 전달)
 *
 * 사용: node scripts/export-branch-module.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = resolve(ROOT, "dist/branch-export");

// ── 복사할 파일/디렉토리 ────────────────────────────────────
// 상대경로(ROOT 기준) — 그대로 DEST에 미러링
const COPY_LIST = [
  // 페이지
  "src/app/(dashboard)/dashboard/branch/page.tsx",
  "src/app/(dashboard)/dashboard/branch/[storeId]/page.tsx",
  "src/app/(dashboard)/dashboard/branch/_components/BranchBrowser.tsx",

  // 핵심 lib
  "src/lib/stores.ts",
  "src/lib/tradeArea.ts",
  "src/lib/tradeAreaTypes.ts",
  "src/lib/realEstate.ts",
  "src/lib/commercialRent.ts",
  "src/lib/localRent.ts",
  "src/lib/congestion/seoul.ts",

  // 지도
  "src/components/maps/KakaoStoreMap.tsx",

  // 공통 UI (brutalist + Black Han Sans 톤)
  "src/lib/tokens.ts",
  "src/components/ui/PageHeader.tsx",
  "src/components/ui/SectionCard.tsx",
  "src/components/ui/AppFooter.tsx",
  "src/components/ui/Badge.tsx",
  "src/components/ui/EmptyState.tsx",
  "src/components/layout/TopBar.tsx",

  // 글로벌 (선택적 — 기존 layout/globals 가 있으면 부분만 채택)
  "src/app/globals.css",
  "src/app/layout.tsx",

  // Supabase 클라이언트 (auth 체크용 — 받는 쪽 기존 사용 시 스킵)
  "src/lib/supabase/server.ts",
  "src/lib/supabase/client.ts",
  "src/lib/supabase/middleware.ts",

  // 데이터
  "data/stores/stores.json",
  "data/stores/stores-raw.json",
  "data/stores/README.md",
  "src/data/seoul-hotspots.json",

  // 스크립트
  "scripts/geocode-stores.mjs",
  "scripts/fetch-trade-area.mjs",
  "scripts/import-seoul-hotspots.mjs",

  // 카카오 지도 CSP 설정 — middleware/next.config 참고용
  "next.config.ts",
];

function copyIfExists(rel) {
  const src = resolve(ROOT, rel);
  const dst = resolve(DEST, rel);
  if (!existsSync(src)) {
    console.warn(`  - 건너뜀 (없음): ${rel}`);
    return false;
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`  ✓ ${rel}`);
  return true;
}

function main() {
  // 이전 dist 청소
  if (existsSync(DEST)) {
    console.log(`🧹 기존 ${DEST} 제거 (수동으로 비우려면 Ctrl+C)`);
  }
  mkdirSync(DEST, { recursive: true });

  console.log(`\n📦 파일 복사 → ${DEST}`);
  let copied = 0;
  for (const rel of COPY_LIST) {
    if (copyIfExists(rel)) copied++;
  }
  console.log(`\n✓ ${copied}/${COPY_LIST.length}개 항목 복사 완료`);

  // ── README 생성 ────────────────────────────────────────
  const readme = `# 상권분석 모듈 — 이식 가이드

이랜드리테일 lifestyle 대시보드의 **상권분석 페이지**를 다른 Next.js 프로젝트로 옮기기 위한 패키지입니다.

생성일: ${new Date().toISOString()}
원본 프로젝트: gana (Next.js 16, Tailwind v4, Supabase, Black Han Sans + Neo-Brutalist)

---

## 📋 들어있는 것

\`\`\`
src/
├─ app/
│   ├─ globals.css                           # brutalist 유틸 + 폰트 패밀리 정의
│   ├─ layout.tsx                            # Black Han Sans + JetBrains Mono 폰트 import
│   └─ (dashboard)/dashboard/branch/
│       ├─ page.tsx                          # 점포 목록
│       ├─ [storeId]/page.tsx                # 점포 상세 (지도/상권/임차료/혼잡도)
│       └─ _components/BranchBrowser.tsx     # 검색·필터 + 카드 그리드
├─ lib/
│   ├─ stores.ts                             # 41개 점포 마스터 로더
│   ├─ tradeArea.ts / tradeAreaTypes.ts      # 상권 분석 (소상공인 OpenAPI 결과 정적)
│   ├─ realEstate.ts                         # 국토부 상업용 매매 실거래가 (proxy)
│   ├─ commercialRent.ts                     # 한국부동산원 권역 평균 임대료
│   ├─ localRent.ts                          # 1차상권 매매가 → 자본환원율 5.5% 환산
│   ├─ congestion/seoul.ts                   # 서울 실시간 도시데이터 (5분 갱신)
│   ├─ tokens.ts                             # brutalist 디자인 토큰
│   └─ supabase/                             # SSR 클라이언트 (auth 체크용)
├─ components/
│   ├─ maps/KakaoStoreMap.tsx                # 카카오 JS SDK 지도
│   ├─ ui/PageHeader, SectionCard, AppFooter, Badge, EmptyState
│   └─ layout/TopBar.tsx
└─ data/
    └─ seoul-hotspots.json                   # 121개 핫스팟 + 좌표

data/stores/
├─ stores.json                               # 41개 점포 (지오코딩 완료, lat/lng/bcode/region)
├─ stores-raw.json                           # 원본 (주소 텍스트만)
└─ README.md

scripts/
├─ geocode-stores.mjs                        # raw → geocoded stores.json (카카오 키 필요)
├─ fetch-trade-area.mjs                      # 소상공인 상가업소 OpenAPI → 상권 분석 정적
└─ import-seoul-hotspots.mjs                 # 서울 데이터광장 엑셀 → JSON
\`\`\`

---

## ⚙️ 받는 쪽 사전 조건

| 항목 | 버전/요구 |
|---|---|
| Next.js | **16.x** (App Router) |
| React | 19.x |
| TypeScript | 5.x |
| Tailwind CSS | **v4** (PostCSS plugin 사용) |
| Node | 20+ |

---

## 🛠 설치 절차

### 1) 폴더에 복사

이 ZIP을 받는 쪽 프로젝트 루트에 풀거나, 각 폴더(src/, data/, scripts/) 내용을 머지하세요. 충돌 가능 파일은 \`globals.css\` / \`layout.tsx\` — 받는 쪽 기존 게 있으면 **수동 머지** 필요 (아래 "기존 프로젝트에 머지" 참고).

### 2) 의존성 설치

\`\`\`bash
npm install next@^16 react@^19 react-dom@^19 \\
  @supabase/ssr @supabase/supabase-js \\
  xlsx sonner
\`\`\`

(차트가 필요하면 \`recharts\` 추가)

### 3) 환경변수 설정 (\`.env.local\`)

\`\`\`bash
# Supabase (auth 체크용 — 사용 안 하면 [storeId]/page.tsx 상단 auth 로직 제거)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# 카카오 지도 JS SDK (KakaoStoreMap.tsx)
NEXT_PUBLIC_KAKAO_JS_KEY=발급받은_JavaScript_키

# 카카오 REST API (geocode-stores.mjs 실행 시)
KAKAO_REST_API_KEY=발급받은_REST_API_키

# 국토부 실거래가 proxy (k-skill-proxy 또는 자체 호스트)
# 기본값: https://k-skill-proxy.nomadamas.org
KSKILL_PROXY_BASE_URL=https://k-skill-proxy.nomadamas.org

# 서울 열린데이터광장 실시간 도시데이터 (혼잡도)
SEOUL_OPEN_API_KEY=발급받은_서울_인증키
\`\`\`

키 발급처:
- 카카오: https://developers.kakao.com (JS / REST 둘 다 한 앱에서)
- 서울: https://data.seoul.go.kr/ → 마이페이지 → 인증키 신청 (즉시 무료)
- k-skill-proxy: 별도 키 불필요 (proxy 측에서 처리)

### 4) Tailwind 설정 확인

받는 쪽 \`tailwind.config\` 가 \`./src/**/*.{ts,tsx}\` 를 포함하는지 확인. v4면 PostCSS 플러그인 자동 인식되므로 별도 설정 거의 불필요.

### 5) 데이터 파일 갱신 (선택)

41개 점포는 이랜드리테일 데이터입니다. 받는 쪽 회사 점포로 바꾸려면:
- \`data/stores/stores-raw.json\` 에 점포 list 작성 (\`id, brand, type, name, address\` 등)
- \`KAKAO_REST_API_KEY\` 설정 후 \`node scripts/geocode-stores.mjs\` 실행 → \`stores.json\` 자동 생성

### 6) 상권 데이터 갱신 (선택)

\`\`\`bash
node scripts/fetch-trade-area.mjs            # 41개 점포 모두
node scripts/fetch-trade-area.mjs --only ID  # 특정 점포만
\`\`\`

소상공인시장진흥공단 상가업소 OpenAPI 데이터를 \`src/data/trade-area-index.json\` 으로 저장.

### 7) 서울 혼잡도 권역 데이터 갱신 (선택)

서울 데이터광장의 \`121장소 목록.xlsx\` 다운로드 → \`data/seoul-hotspots.xlsx\` 로 저장 → \`node scripts/import-seoul-hotspots.mjs\` 실행 (KAKAO_REST_API_KEY로 좌표 자동 보강).

---

## 🚀 실행

\`\`\`bash
npm run dev
# 또는
npm run build && npm start
\`\`\`

접속:
- 점포 목록: \`http://localhost:3000/dashboard/branch\`
- 점포 상세: \`http://localhost:3000/dashboard/branch/<storeId>\`

---

## 📦 기존 프로젝트에 머지하는 경우

\`globals.css\` 와 \`layout.tsx\` 는 **머지 충돌** 가능성이 큽니다. 다음만 가져가세요:

### globals.css — 추가할 블록
- \`:root\` 변수 (--paper, --ink, --accent-*)
- \`.brutal, .brutal-lg, .brutal-sm, .brutal-flat, .brutal-hover\` 유틸
- \`.chip-*\`, \`.font-display, .font-mono\` 정의
- \`.mono\` 모드 override (선택)

### layout.tsx — 추가할 코드
\`\`\`tsx
import { JetBrains_Mono, Archivo_Black, Black_Han_Sans } from "next/font/google";

const jetbrains    = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });
const archivoBlack = Archivo_Black({ variable: "--font-display-en", subsets: ["latin"], weight: "400" });
const blackHanSans = Black_Han_Sans({ variable: "--font-display", subsets: ["latin"], weight: "400" });

<html className={\`\${jetbrains.variable} \${archivoBlack.variable} \${blackHanSans.variable}\`}>
\`\`\`

---

## 🎨 디자인 시스템 요약

받는 쪽이 자체 디자인을 쓰고 싶다면 **lib/tokens.ts** 의 클래스만 갈아끼우면 됩니다. 예: \`brutal\` → \`rounded-xl shadow\`.

\`PageHeader\`, \`SectionCard\`, \`Stat\`, \`Badge\` 같은 컴포넌트는 톤이 강한 brutalist 모양이지만, props 인터페이스만 유지하면 내부 스타일은 자유롭게 교체 가능.

---

## 🆘 받는 쪽 클로드에게 안내할 한 줄

> "프로젝트 루트에 이 ZIP을 풀고 README.md 절차대로 진행. 카카오/서울 키만 발급받아 .env.local에 추가하면 됩니다."

---

## 📞 알려진 한계 / 후속

- 점포 좌표가 잘못되어 있으면 1km 임차료/혼잡도 매칭이 깨집니다 → \`geocode-stores.mjs\` 먼저
- 서울 실시간 혼잡도는 121개 핫스팟 권역 기준이라 서울 점포만 매칭됨 (지방은 fallback 데이터 별도)
- 인구 분포(행안부 API)는 추가 통합 작업 필요 (\`scripts/fetch-population.mjs\` 별도 패키지)
- 임차료는 매매 실거래가 환산 추정치 (자본환원율 5.5%) — 실시장과 차이 가능
- 카카오 지도 SDK는 next.config CSP \`script-src\`, \`connect-src\` 에 카카오 도메인 허용 필요

---

생성: \`scripts/export-branch-module.mjs\` (gana 프로젝트)
`;

  writeFileSync(resolve(DEST, "README.md"), readme, "utf8");
  console.log(`  ✓ README.md`);

  // ── .env.example ───────────────────────────────────────
  const envExample = `# 상권분석 모듈 환경변수

# ─── Supabase (auth 체크용; 사용 안 하면 [storeId]/page.tsx 상단 auth 로직 제거) ───
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ─── 카카오 (지도 + 지오코딩) ───
NEXT_PUBLIC_KAKAO_JS_KEY=
KAKAO_REST_API_KEY=

# ─── 국토부 실거래가 proxy ───
KSKILL_PROXY_BASE_URL=https://k-skill-proxy.nomadamas.org

# ─── 서울 실시간 도시데이터 (혼잡도) ───
SEOUL_OPEN_API_KEY=
`;
  writeFileSync(resolve(DEST, ".env.example"), envExample, "utf8");
  console.log(`  ✓ .env.example`);

  // ── package.json subset ─────────────────────────────────
  const pkgSubset = {
    name: "branch-analytics-module",
    description: "상권분석 모듈 (이식용 의존성 목록)",
    private: true,
    dependencies: {
      "next": "^16.2.4",
      "react": "^19.2.4",
      "react-dom": "^19.2.4",
      "@supabase/ssr": "^0.10.2",
      "@supabase/supabase-js": "^2.105.0",
      "xlsx": "^0.18.5",
      "sonner": "^2.0.7",
    },
    devDependencies: {
      "@tailwindcss/postcss": "^4",
      "tailwindcss": "^4",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "typescript": "^5",
      "eslint": "^9",
      "eslint-config-next": "^16",
    },
    note: "받는 쪽 package.json에 위 의존성을 머지하거나 npm install. 카카오 JS SDK는 외부 script tag로 로드 (KakaoStoreMap.tsx)",
  };
  writeFileSync(
    resolve(DEST, "package.dependencies.json"),
    JSON.stringify(pkgSubset, null, 2),
    "utf8",
  );
  console.log(`  ✓ package.dependencies.json`);

  console.log(`\n🎉 ${DEST} 완성`);
  console.log(`\n다음 단계:`);
  console.log(`  1. ${DEST} 폴더를 ZIP으로 압축 (Windows: 우클릭 → 보내기 → 압축파일)`);
  console.log(`  2. ZIP 파일을 받는 쪽 개발자에게 전달 (메일/슬랙/USB)`);
  console.log(`  3. 받는 쪽은 README.md 절차대로 진행`);
}

main();
