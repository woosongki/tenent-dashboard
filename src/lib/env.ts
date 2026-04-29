/**
 * 필수 환경변수 유효성 검사.
 * 서버 컴포넌트나 API Route에서 import하면 빌드/런타임 초기에 누락을 감지합니다.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[env] 필수 환경변수 "${key}"가 설정되지 않았습니다.\n` +
      `.env.local 또는 Vercel 프로젝트 환경변수를 확인하세요.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl:            requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey:        requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  // service role key는 런타임 서버 컨텍스트에서만 접근하므로 지연 평가
  get supabaseServiceKey() { return requireEnv("SUPABASE_SERVICE_ROLE_KEY"); },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000",
} as const;
