import { createClient } from "@/lib/supabase/server";

export interface CalendarAssignment {
  id: string;
  weekIndex: number;
  contactNo: number;
  contactBrand: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  week_index: number;
  contact_no: number;
  contact_brand: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function toDomain(r: Row): CalendarAssignment {
  return {
    id:           r.id,
    weekIndex:    r.week_index,
    contactNo:    r.contact_no,
    contactBrand: r.contact_brand,
    note:         r.note,
    createdBy:    r.created_by,
    createdAt:    r.created_at,
    updatedAt:    r.updated_at,
  };
}

/** 조직의 모든 매핑을 weekIndex별로 그룹화해 반환 */
export async function getCalendarAssignments(
  organizationId: string,
): Promise<Record<number, CalendarAssignment[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("popup_calendar_assignments")
    .select("id, week_index, contact_no, contact_brand, note, created_by, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error || !data) return {};

  const grouped: Record<number, CalendarAssignment[]> = {};
  for (const r of data as Row[]) {
    (grouped[r.week_index] ??= []).push(toDomain(r));
  }
  return grouped;
}
