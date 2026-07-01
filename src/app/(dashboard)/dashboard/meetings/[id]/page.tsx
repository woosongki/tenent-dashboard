import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import VendorDetail, { type VendorSessionRow, type VendorRow } from "../_components/VendorDetail";

export const metadata: Metadata = { title: "업체미팅 · 상세 — lifestyle" };

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("vendor_meetings")
    .select("id,brand,company,corp_code,stage,brief_payload,brief_summary,meeting_payload,created_by,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  const { data: sessions } = await supabase
    .from("vendor_meeting_sessions")
    .select("id,meeting_id,session_index,title,held_at,raw_text,extracted,created_by,created_at,updated_at")
    .eq("meeting_id", id)
    .order("session_index", { ascending: false });

  return (
    <VendorDetail
      row={row as VendorRow}
      sessions={(sessions ?? []) as VendorSessionRow[]}
    />
  );
}
