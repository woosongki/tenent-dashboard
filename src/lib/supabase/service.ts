import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * 서비스 롤 클라이언트 (쿠키 비의존, RLS 우회).
 * 사용자별이 아닌 참조성 데이터(매출 등) 읽기 + unstable_cache 캐싱용.
 * 호출 페이지는 별도로 인증 게이트를 거친 뒤 사용한다.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.");
  return createClient(url, key, { auth: { persistSession: false } });
}
