"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(): Promise<{ adminId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m || (m.role !== "owner" && m.role !== "admin")) {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return { adminId: user.id };
}

export async function approveUser(
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { adminId } = await requireAdmin();
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
