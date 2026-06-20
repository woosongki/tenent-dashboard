"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("편집 권한이 없습니다.");
  return ctx;
}

export interface PopupInput {
  brand: string;
  store: string;
  startDate: string;
  endDate: string;
  channel?: string | null;
  popupType?: string | null;
  promo?: string | null;
  vendor?: string | null;
  sales?: number | null;
  note?: string | null;
  year?: number;
}

type Result = { ok: true; id?: string } | { ok: false; error: string };

function validate(p: PopupInput): string | null {
  if (!p.brand?.trim()) return "브랜드를 입력하세요.";
  if (!p.store?.trim()) return "지점을 입력하세요.";
  if (!p.startDate || !p.endDate) return "기간을 입력하세요.";
  if (p.endDate < p.startDate) return "종료일이 시작일보다 빠릅니다.";
  return null;
}

function toRow(p: PopupInput) {
  return {
    year: p.year ?? 2026,
    brand: p.brand.trim(),
    store: p.store.trim(),
    start_date: p.startDate,
    end_date: p.endDate,
    channel: p.channel || null,
    popup_type: p.popupType || null,
    promo: p.promo || null,
    vendor: p.vendor?.trim() || null,
    sales: p.sales == null || Number.isNaN(p.sales) ? null : p.sales,
    note: p.note?.trim() || null,
  };
}

export async function createPopup(input: PopupInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  let ctx;
  try { ctx = await requireAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("living_popup")
    .insert({ ...toRow(input), organization_id: ctx.orgId, created_by: ctx.userId, updated_by: ctx.userId })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/living");
  return { ok: true, id: data?.id };
}

export async function updatePopup(id: string, input: PopupInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  let ctx;
  try { ctx = await requireAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = await createClient();
  const { error } = await supabase
    .from("living_popup")
    .update({ ...toRow(input), updated_by: ctx.userId })
    .eq("id", id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/living");
  return { ok: true };
}

export async function deletePopup(id: string): Promise<Result> {
  let ctx;
  try { ctx = await requireAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = await createClient();
  const { error } = await supabase
    .from("living_popup")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/living");
  return { ok: true };
}
