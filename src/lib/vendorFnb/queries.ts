import { createClient } from "@/lib/supabase/server";
import type { VendorFnbRow } from "@/types/vendorFnb";

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

export async function getVendorFnb(): Promise<VendorFnbRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_fnb")
    .select("id, name, types, score, is_checked, status, link, contact, keyman, memo, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToVendor);
}
