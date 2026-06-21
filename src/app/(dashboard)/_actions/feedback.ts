"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackStatus } from "@/lib/feedback";

type Result = { ok: true } | { ok: false; error: string };

type Ctx = Awaited<ReturnType<typeof createClient>>;
type CtxResult =
  | { ok: false; error: string }
  | { ok: true; supabase: Ctx; userId: string; email: string | null; orgId: string; role: string | null };

async function ctx(): Promise<CtxResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: m } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m?.organization_id) return { ok: false, error: "소속 조직이 없습니다." };
  return { ok: true, supabase, userId: user.id, email: user.email ?? null, orgId: m.organization_id as string, role: (m.role as string) ?? null };
}

function isAdmin(role: string | null) {
  return role === "owner" || role === "admin";
}

/** 의견 작성 — 조직원 전원 가능 */
export async function submitFeedback(input: { category: string; message: string }): Promise<Result> {
  const msg = input.message?.trim();
  if (!msg) return { ok: false, error: "내용을 입력하세요." };
  if (msg.length > 2000) return { ok: false, error: "내용이 너무 깁니다 (2000자 이내)." };
  const c = await ctx();
  if (!c.ok) return { ok: false, error: c.error };
  const { error } = await c.supabase.from("app_feedback").insert({
    organization_id: c.orgId,
    user_id: c.userId,
    author_email: c.email,
    category: input.category?.trim() || null,
    message: msg,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}

/** 상태 변경 — 관리자만 */
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<Result> {
  const c = await ctx();
  if (!c.ok) return { ok: false, error: c.error };
  if (!isAdmin(c.role)) return { ok: false, error: "권한이 없습니다." };
  const { error } = await c.supabase
    .from("app_feedback")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", c.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}

/** 삭제 — 관리자만 */
export async function deleteFeedback(id: string): Promise<Result> {
  const c = await ctx();
  if (!c.ok) return { ok: false, error: c.error };
  if (!isAdmin(c.role)) return { ok: false, error: "권한이 없습니다." };
  const { error } = await c.supabase
    .from("app_feedback")
    .delete()
    .eq("id", id)
    .eq("organization_id", c.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}
