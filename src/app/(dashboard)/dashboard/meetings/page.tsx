import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPopupContacts } from "@/lib/popupContacts";
import MeetingsClient, { type RecentBrief, type ContactSeed } from "./_components/MeetingsClient";

export const metadata: Metadata = { title: "업체미팅 — lifestyle" };

export default async function MeetingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const orgId: string | null = membership?.organization_id ?? null;

  // 최근 브리프 12개 (재조회 칩 + 캐시 인디케이터용)
  const { data: recentRows } = orgId
    ? await supabase
        .from("vendor_meetings")
        .select("id,brand,company,brief_summary,created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [] };

  const recent: RecentBrief[] = (recentRows ?? []).map((r) => ({
    id: r.id as string,
    brand: r.brand as string,
    company: (r.company as string | null) ?? null,
    summary: (r.brief_summary as string | null) ?? null,
    createdAt: r.created_at as string,
  }));

  // popup-contacts에서 typeahead용 최소 정보만 전달 (608개 → 가벼움)
  const contacts: ContactSeed[] = getPopupContacts()
    .filter((c) => c.brand)
    .map((c) => ({
      brand: c.brand,
      company: c.company,
      field: c.field ?? null,
      stage: (c.stage as string | null) ?? null,
      manager: c.manager,
      hopeStore: c.hopeStore,
    }));

  return <MeetingsClient contacts={contacts} recent={recent} />;
}
