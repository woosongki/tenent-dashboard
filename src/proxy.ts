import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// 인증 없이 접근 가능한 공개 경로
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/error", "/homeplus-map.html"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 에셋은 그냥 통과
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next({ request });
  }

  const { response, user } = await updateSession(request);

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // 미인증 → 공개 경로가 아니면 로그인으로
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 인증된 상태에서 로그인 페이지 → 대시보드로
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
