import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const url = new URL("/auth/error", origin);
    url.searchParams.set("message", errorDescription ?? error);
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // next 파라미터가 외부 URL로의 오픈 리다이렉트가 되지 않도록 검증
      const redirectPath = next.startsWith("/") ? next : "/dashboard";
      return NextResponse.redirect(new URL(redirectPath, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/error?message=인증에+실패했습니다.", origin));
}
