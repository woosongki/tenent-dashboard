import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPopupContacts } from "@/lib/popupContacts";
import { getRecentMeetings } from "@/lib/meetings/recent";
import MeetingsClient, { type ContactSeed } from "./_components/MeetingsClient";

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

  const recent = orgId ? await getRecentMeetings(orgId, 20) : [];

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
