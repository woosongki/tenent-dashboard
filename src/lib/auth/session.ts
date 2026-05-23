import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "member";

export interface SessionContext {
  user: User | null;
  isApproved: boolean;
  role: Role | null;
}

/**
 * 한 요청 내에서 인증 + 권한 정보를 1회만 조회.
 *
 * Next.js 16 React `cache()`로 메모이즈됨 → layout/page/api route가 동일
 * 요청 내에서 여러 번 호출해도 DB 왕복은 1회 (profiles + organization_members 병렬 2쿼리).
 *
 * Supabase egress 절감:
 *   - 이전: layout 1회 + verify/page 1회 + api route 1회 = 9개 row 응답
 *   - 이후: 1회 = 2개 row 응답 (-78%)
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isApproved: false, role: null };
  }

  // 병렬 2쿼리 (JOIN은 FK 종속이라 안정성 위해 분리, cache로 중복 제거가 핵심)
  const [profileRes, membershipRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    user,
    isApproved: Boolean(profileRes.data?.is_approved),
    role: (membershipRes.data?.role as Role | undefined) ?? null,
  };
});

/**
 * 요청 내 User만 캐시 조회 (auth.getUser()는 자체적으로 cookies 검증)
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
