"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VendorFnbRow } from "@/types/vendorFnb";

type UpsertPayload = Omit<VendorFnbRow, "id" | "created_at" | "updated_at">;
type Result = { ok: true; row: VendorFnbRow } | { ok: false; error: string };

function rowToVendor(r: Record<string, unknown>): VendorFnbRow {
  return {
    id:         r.id as string,
    name:       r.name as string,
    types:      (r.types as string[]) ?? [],
    score:      r.score as string | null,
    is_checked: Boolean(r.is_checked),
    status:     r.status as string | null,
    link:       r.link as string | null,
    contact:    r.contact as string | null,
    keyman:     r.keyman as string | null,
    memo:       r.memo as string | null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export async function upsertVendorFnb(
  id: string | null,
  payload: UpsertPayload,
): Promise<Result> {
  const supabase = await createClient();

  const record = {
    name:       payload.name,
    types:      payload.types,
    score:      payload.score || null,
    is_checked: payload.is_checked,
    status:     payload.status || null,
    link:       payload.link || null,
    contact:    payload.contact || null,
    keyman:     payload.keyman || null,
    memo:       payload.memo || null,
    updated_at: new Date().toISOString(),
  };

  let query;
  if (id) {
    query = supabase.from("vendor_fnb").update(record).eq("id", id).select().single();
  } else {
    query = supabase.from("vendor_fnb").insert(record).select().single();
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/goals");
  return { ok: true, row: rowToVendor(data as Record<string, unknown>) };
}

export async function deleteVendorFnb(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_fnb").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/goals");
  return { ok: true };
}
