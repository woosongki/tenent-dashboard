import { SPACE, TYPO } from "@/lib/tokens";
import { getSessionContext } from "@/lib/auth/session";
import VerifyClient from "./_components/VerifyClient";

export default async function VerifyPage() {
  // Layout에서 이미 조회한 session을 cache()로 재사용 (DB 추가 호출 0)
  const { role } = await getSessionContext();
  const canVerify = role === "owner" || role === "admin";

  return (
    <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
      <div className={SPACE.pageMaxW}>
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className={`${TYPO.pageTitle} font-display`}>컨텐츠 검증</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            DART + 뉴스 + 자체 데이터 → Claude 분석 → Notion 저장 · <strong>30일 캐시로 비용 절감</strong>
          </p>
        </div>

        {/* 안내 배너 */}
        <SetupBanner />

        {!canVerify && (
          <div className="brutal-sm mb-4 border-slate-400 bg-slate-50 p-4">
            <p className="font-bold text-slate-700">조회 전용 모드 (member 권한)</p>
            <p className="mt-1 text-[12px] text-slate-600">
              API 비용 보호를 위해 신규 검증은 owner/admin 권한자만 실행할 수 있습니다.
              아래에서 회사 검색은 가능하며, 결과는 Notion DB에서 누구나 조회 가능합니다.
            </p>
          </div>
        )}

        {/* 검증 인터페이스 */}
        <VerifyClient canVerify={canVerify} />
      </div>
    </main>
  );
}

function SetupBanner() {
  const dartKey = !!process.env.DART_API_KEY;
  const anthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const naverKey = !!process.env.NAVER_SEARCH_CLIENT_ID;

  const missing: string[] = [];
  if (!dartKey) missing.push("DART_API_KEY");
  if (!anthropicKey) missing.push("ANTHROPIC_API_KEY");
  if (!naverKey) missing.push("NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET");

  if (missing.length === 0) return null;

  return (
    <div className="brutal-sm mb-4 border-yellow-400 bg-yellow-50 p-4">
      <p className="font-bold text-yellow-800">API 키 설정 필요</p>
      <p className="mt-1 text-[12px] text-yellow-700">
        .env.local에 다음 환경변수를 추가하세요:
      </p>
      <ul className="mt-1 list-disc pl-5 text-[12px] font-mono text-yellow-800">
        {missing.map((k) => <li key={k}>{k}</li>)}
      </ul>
      {!process.env.NOTION_DB_VERIFY_TENANT_ID && (
        <p className="mt-2 text-[11px] text-yellow-600">
          Notion DB가 없으면 <code>node scripts/setup-verify-notion.mjs</code>를 실행하세요.
        </p>
      )}
      {dartKey && !process.env.DART_CORP_CODES_LOADED && (
        <p className="mt-1 text-[11px] text-yellow-600">
          DART 법인 코드 캐시가 없으면 <code>node scripts/dart-sync-corp-codes.mjs</code>를 실행하세요.
        </p>
      )}
    </div>
  );
}
