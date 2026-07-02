import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { findContractsByBrand } from "@/lib/tenantContracts";
import VendorDetail, { type VendorSessionRow, type VendorRow } from "../_components/VendorDetail";

export const metadata: Metadata = { title: "업체미팅 · 상세 — lifestyle" };

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { user, role } = await getSessionContext();
  if (!user) redirect("/login");
  const canAnalyze = role === "owner" || role === "admin";   // AI 심층분석(LLM) 실행 권한

  const { data: row } = await supabase
    .from("vendor_meetings")
    .select("id,brand,company,corp_code,stage,brief_payload,brief_summary,meeting_payload,analysis,analyzed_at,created_by,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  const { data: sessions } = await supabase
    .from("vendor_meeting_sessions")
    .select("id,meeting_id,session_index,title,held_at,raw_text,extracted,created_by,created_at,updated_at")
    .eq("meeting_id", id)
    .order("session_index", { ascending: false });

  const contracts = findContractsByBrand(row.brand as string);

  return (
    <VendorDetail
      row={row as VendorRow}
      sessions={(sessions ?? []) as VendorSessionRow[]}
      canAnalyze={canAnalyze}
      contracts={contracts}
    />
  );
}
