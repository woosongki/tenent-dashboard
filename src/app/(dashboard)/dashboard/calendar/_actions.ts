"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCalendar52 } from "@/lib/calendar52";

async function requireOrgId(): Promise<{ orgId: string; userId: string; role: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!m?.organization_id) throw new Error("소속 조직이 없습니다.");
  return { orgId: m.organization_id, userId: user.id, role: m.role ?? null };
}

async function requireAdmin() {
  const ctx = await requireOrgId();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("편집 권한이 없습니다.");
  }
  return ctx;
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

// ── 캘린더 주차 편집 ────────────────────────────────────────

export interface WeekPatch {
  monthKw?:   string;
  concept?:   string;
  grade?:     string;
  intensity?: "high" | "mid" | "low";
  others?:    { label: string; color?: string; text: string }[];
  extEvents?: { label: string; text: string }[];
  popups?:    { label: string; color?: string; text: string }[];
  item?:      string;
  hotsauce?:  string;
  bestCat?:   string;
}

/** 첫 편집 시 정적 JSON 시드를 DB로 import (admin only) */
async function ensureSeeded(orgId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { count } = await supabase
    .from("calendar52_weeks")
    .select("week_index", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if ((count ?? 0) > 0) return;
  const seed = getCalendar52();
  const rows = seed.map((r) => ({
    organization_id: orgId,
    week_index:      r.index,
    month:           r.month,
    season:          r.season,
    month_kw:        r.monthKw,
    week_no:         r.weekNo,
    concept:         r.concept,
    grade:           r.grade,
    intensity:       r.intensity,
    others:          r.others,
    ext_events:      r.extEvents,
    popups:          r.popups,
    item:            r.item,
    hotsauce:        r.hotsauce,
    best_cat:        r.bestCat,
  }));
  await supabase.from("calendar52_weeks").upsert(rows, { onConflict: "organization_id,week_index" });
}

export async function updateCalendarWeek(
  weekIndex: number,
  patch: WeekPatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(weekIndex) || weekIndex < 0 || weekIndex > 51) {
    return { ok: false, error: "잘못된 주차" };
  }
  let ctx;
  try { ctx = await requireAdmin(); } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  await ensureSeeded(ctx.orgId, supabase);

  const update: Record<string, unknown> = { updated_by: ctx.userId };
  if (patch.monthKw   !== undefined) update.month_kw   = patch.monthKw;
  if (patch.concept   !== undefined) update.concept    = patch.concept;
  if (patch.grade     !== undefined) update.grade      = patch.grade;
  if (patch.intensity !== undefined) update.intensity  = patch.intensity;
  if (patch.others    !== undefined) update.others     = patch.others;
  if (patch.extEvents !== undefined) update.ext_events = patch.extEvents;
  if (patch.popups    !== undefined) update.popups     = patch.popups;
  if (patch.item      !== undefined) update.item       = patch.item;
  if (patch.hotsauce  !== undefined) update.hotsauce   = patch.hotsauce;
  if (patch.bestCat   !== undefined) update.best_cat   = patch.bestCat;

  const { error } = await supabase
    .from("calendar52_weeks")
    .update(update)
    .eq("organization_id", ctx.orgId)
    .eq("week_index", weekIndex);
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
