import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import AppShell from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 단일 캐시 호출 — profiles + organization_members 병렬 조회 (한 요청 내 1회만)
  const { user, isApproved, role } = await getSessionContext();

  if (!user) redirect("/login");
  if (!isApproved) redirect("/pending-approval");

  const displayName = user.user_metadata?.full_name ?? user.email ?? "";

  return (
    <AppShell userEmail={displayName} role={role}>
      {children}
    </AppShell>
  );
}
