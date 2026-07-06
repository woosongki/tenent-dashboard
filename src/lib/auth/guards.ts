import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSessionContext, type Role } from "./session";

// API 라우트 공통 인증 가드.
//   - 지금까지 라우트마다 getUser/getSessionContext 를 제각각 호출했고,
//     '승인(isApproved)' 은 대시보드 레이아웃에서만 확인해 API 는 무방비였다.
//     → 미승인 사용자가 외부 API 비용이 드는 라우트(brand-keyword 등)를 직접 호출 가능.
//   - 이 가드로 인증·승인·역할 체크를 한 곳에 통일한다.
//
// 사용:
//   const g = await requireApproved();
//   if (!g.ok) return g.response;
//   // 이후 g.user, g.role 사용

export type GuardOk = { ok: true; user: User; role: Role | null };
export type GuardFail = { ok: false; response: Response };
export type GuardResult = GuardOk | GuardFail;

function json(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

/** 로그인만 요구. */
export async function requireUser(): Promise<GuardResult> {
  const { user, role } = await getSessionContext();
  if (!user) return { ok: false, response: json("인증이 필요합니다.", 401) };
  return { ok: true, user, role };
}

/** 로그인 + 승인(is_approved) 요구. 일반 API 의 기본 가드. */
export async function requireApproved(): Promise<GuardResult> {
  const { user, isApproved, role } = await getSessionContext();
  if (!user) return { ok: false, response: json("인증이 필요합니다.", 401) };
  if (!isApproved) return { ok: false, response: json("승인 대기 중인 계정입니다.", 403) };
  return { ok: true, user, role };
}

/** 로그인 + 승인 + 지정 역할 요구(비용/권한 보호). owner/admin 은 승인 여부 무관하게 통과. */
export async function requireRole(...roles: Role[]): Promise<GuardResult> {
  const { user, isApproved, role } = await getSessionContext();
  if (!user) return { ok: false, response: json("인증이 필요합니다.", 401) };
  const privileged = role === "owner" || role === "admin";
  if (!privileged && !isApproved) return { ok: false, response: json("승인 대기 중인 계정입니다.", 403) };
  if (!role || !roles.includes(role)) {
    return { ok: false, response: json(`권한이 없습니다 (${roles.join("/")} 전용).`, 403) };
  }
  return { ok: true, user, role };
}
