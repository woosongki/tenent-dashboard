import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 승인 게이트 — 미승인자는 /pending-approval로 격리
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_approved) redirect("/pending-approval");

  // role 조회 — admin 메뉴 노출 제어
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const role: "owner" | "admin" | "member" | null =
    (membership?.role as "owner" | "admin" | "member" | undefined) ?? null;

  const displayName = user.user_metadata?.full_name ?? user.email ?? "";

  return (
    <AppShell userEmail={displayName} role={role}>
      {children}
    </AppShell>
  );
}
