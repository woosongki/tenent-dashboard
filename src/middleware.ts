import { NextResponse, type NextRequest } from "next/server";

// 현재 pathname을 헤더에 실어 서버 컴포넌트(layout)가 경로 기반 메뉴 차단을 할 수 있게 한다.
// 인증 쿠키는 건드리지 않음(헤더 통과만) — DB 호출 0.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
