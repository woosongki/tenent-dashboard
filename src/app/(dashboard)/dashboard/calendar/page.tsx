import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
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
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
              52주 마케팅 캘린더
            </h1>
            <span className="text-[13px] text-slate-400 tabular-nums">{weeks.length}주</span>
          </div>
          <p className="mt-1 text-[13px] text-slate-400">
            연간 시즌·컨셉별 팝업 후보 캘린더 · 컨텐츠 풀 컨텍판 매칭{" "}
            <span className="text-violet-600 font-medium">
              · 자동 {matchedWeeks}주/{matchedTotal}건
            </span>
            <span className="text-amber-600 font-medium">
              {" · 핀 "}
              {pinnedWeeks}주/{pinnedTotal}건
            </span>
            <span className="text-slate-400">
              {source === "db" ? " · DB 편집" : " · 시드(읽기)"}
            </span>
          </p>
        </div>

        <CalendarBoard
          weeks={weeks}
          matches={matches}
          contacts={contacts}
          assignments={assignments}
          canEdit={!!orgId}
          canEditWeek={canEditWeek}
        />
      </main>
    </div>
  );
}
