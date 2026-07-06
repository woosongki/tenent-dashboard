"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidMenuKey } from "@/lib/nav";

/** 사용자별 숨김 메뉴(deny-list) 저장 — 관리자 전용. owner/admin 대상은 앱에서 면제되므로 무의미하나 저장은 허용. */
export async function setUserHiddenMenus(
  targetId: string, hidden: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId } = await requireAdmin();
  const supabase = await createClient();
  const clean = [...new Set((hidden ?? []).filter(isValidMenuKey))];
  const { error } = await supabase
    .from("organization_members")
    .update({ hidden_menus: clean })
    .eq("user_id", targetId)
    .eq("organization_id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}

async function requireAdmin(): Promise<{ adminId: string; orgId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase
    .from("organization_members")
    .select("role, organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m || (m.role !== "owner" && m.role !== "admin")) {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return { adminId: user.id, orgId: m.organization_id as string };
}

export async function approveUser(
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { adminId, orgId } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_approved:    true,
      approved_at:    new Date().toISOString(),
      approved_by:    adminId,
      rejected_at:    null,
      rejection_reason: null,
    })
    .eq("id", targetId);
  if (error) return { ok: false, error: error.message };
  // 승인과 동시에 admin 본인 조직에 멤버로 자동 등록 (이미 있으면 무시).
  // Why: 조직 멤버십이 없으면 매출분석·리빙주제전 등 조직-스코프 데이터가 RLS로 막혀 빈 화면이 됨.
  await supabase
    .from("organization_members")
    .upsert(
      { organization_id: orgId, user_id: targetId, role: "member" },
      { onConflict: "organization_id,user_id", ignoreDuplicates: true },
    );
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}

export async function rejectUser(
  targetId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const trimmed = reason.trim();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_approved:      false,
      approved_at:      null,
      approved_by:      null,
      rejected_at:      new Date().toISOString(),
      rejection_reason: trimmed === "" ? "사유 없음" : trimmed,
    })
    .eq("id", targetId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}

/** 조직 내 사용자 권한 변경 — admin ↔ member. owner는 대상/주체 모두 불가, 본인 변경 불가. */
export async function setUserRole(
  targetId: string,
  role: "admin" | "member",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (role !== "admin" && role !== "member") {
    return { ok: false, error: "허용되지 않는 권한입니다." };
  }
  const { adminId, orgId } = await requireAdmin();
  if (targetId === adminId) {
    return { ok: false, error: "본인의 권한은 변경할 수 없습니다." };
  }
  const supabase = await createClient();
  const { data: cur, error: cErr } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", targetId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  if (!cur) return { ok: false, error: "조직 멤버가 아닙니다. 먼저 승인해 주세요." };
  if (cur.role === "owner") return { ok: false, error: "owner의 권한은 변경할 수 없습니다." };

  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("user_id", targetId)
    .eq("organization_id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}

export async function revokeApproval(
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_approved:      false,
      approved_at:      null,
      approved_by:      null,
      rejection_reason: null,
    })
    .eq("id", targetId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}
