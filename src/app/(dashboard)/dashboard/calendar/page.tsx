import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import { getCalendar52Meta } from "@/lib/calendar52";
import { getCalendarWeeksForOrg, buildPopupMatches } from "@/lib/calendarWeeks";
import { getPopupContacts } from "@/lib/popupContacts";
import { getCalendarAssignments } from "@/lib/calendarAssignments";
import CalendarBoard from "./_components/CalendarBoard";

export const metadata: Metadata = { title: "52주 캘린더 — lifestyle" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  const orgId: string | null = membership?.organization_id ?? null;
  const role: "owner" | "admin" | "member" | null =
    (membership?.role as "owner" | "admin" | "member" | undefined) ?? null;
  const canEditWeek = role === "owner" || role === "admin";

  const { weeks, source } = await getCalendarWeeksForOrg(orgId);
  const meta              = getCalendar52Meta();
  const matches           = buildPopupMatches(weeks);
  const contacts          = getPopupContacts();
  const assignments       = orgId ? await getCalendarAssignments(orgId) : {};

  // 매칭 + 직접배정 합산 통계
  const matchedTotal = Object.values(matches).reduce((s, arr) => s + arr.length, 0);
  const matchedWeeks = Object.keys(matches).length;
  const pinnedTotal  = Object.values(assignments).reduce((s, arr) => s + arr.length, 0);
  const pinnedWeeks  = Object.keys(assignments).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "52주 캘린더" }]}
        lastUpdated={meta.importedAt}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="MARKETING CALENDAR"
            title="52주 마케팅 캘린더"
            subtitle="연간 시즌·컨셉별 팝업 후보를 주차 단위로 관리하고, 팝업 컨텍판과 자동·수동으로 연결합니다."
            meta={
              `${weeks.length}주 · ` +
              `자동 ${matchedWeeks}주/${matchedTotal}건 · ` +
              `핀 ${pinnedWeeks}주/${pinnedTotal}건 · ` +
              (source === "db" ? "DB 편집" : "시드")
            }
          />

          <CalendarBoard
            weeks={weeks}
            matches={matches}
            contacts={contacts}
            assignments={assignments}
            canEdit={!!orgId}
            canEditWeek={canEditWeek}
          />

          <AppFooter />
        </div>
      </main>
    </div>
  );
}
