// Next.js 16 Proxy (구 Middleware) — Supabase 세션 자동 갱신
//
// 역할: 모든 요청 전에 Supabase 액세스 토큰을 갱신해 쿠키에 반영.
//   이게 없으면 토큰 만료 시 사용자가 갑자기 로그아웃되거나
//   서버 컴포넌트에서 인증이 끊기는 문제가 발생한다.
//
// 페이지/API의 실제 접근 권한 체크는 각 layout·route에서 계속 수행한다.
// 여기서는 세션 유지(토큰 리프레시)만 담당.

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // updateSession은 { response, user }를 반환 — Proxy는 Response를 반환해야 함
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // 정적 자산 제외한 모든 경로
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
