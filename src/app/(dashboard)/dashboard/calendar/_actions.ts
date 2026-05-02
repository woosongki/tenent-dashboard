"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireOrgId(): Promise<{ orgId: string; userId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!m?.organization_id) throw new Error("소속 조직이 없습니다.");
  return { orgId: m.organization_id, userId: user.id };
}

/** 컨텍판 브랜드를 특정 주차에 매핑 (toggle) */
export async function assignContactToWeek(
  weekIndex: number,
  contactNo: number,
  contactBrand: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(weekIndex) || weekIndex < 0 || weekIndex > 51) {
    return { ok: false, error: "잘못된 주차" };
  }
  if (!Number.isInteger(contactNo) || contactNo < 1) {
    return { ok: false, error: "잘못된 컨택 번호" };
  }
  const { orgId, userId } = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("popup_calendar_assignments")
    .upsert(
      {
        organization_id: orgId,
        week_index: weekIndex,
        contact_no: contactNo,
        contact_brand: contactBrand,
        created_by: userId,
      },
      { onConflict: "organization_id,week_index,contact_no" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export async function unassignContact(
  assignmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId } = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("popup_calendar_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("organization_id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export async function updateAssignmentNote(
  assignmentId: string,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId } = await requireOrgId();
  const supabase = await createClient();
  const trimmed = note.trim();
  const { error } = await supabase
    .from("popup_calendar_assignments")
    .update({ note: trimmed === "" ? null : trimmed })
    .eq("id", assignmentId)
    .eq("organization_id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
