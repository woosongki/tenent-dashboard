import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionContext } from "@/lib/auth/session";
import { menuKeyForPath } from "@/lib/nav";
import AppShell from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 단일 캐시 호출 — profiles + organization_members 병렬 조회 (한 요청 내 1회만)
  const { user, isApproved, role, hiddenMenus } = await getSessionContext();

  if (!user) redirect("/login");
  if (!isApproved) redirect("/pending-approval");

  // owner/admin은 메뉴 제한 면제. member에 한해 숨김+차단 적용.
  const isAdmin = role === "owner" || role === "admin";
  const effectiveHidden = isAdmin ? [] : hiddenMenus;

  // 서버단 차단: 현재 경로가 숨김 메뉴면 대시보드로 리다이렉트(URL 직접 접근 방지)
  if (effectiveHidden.length > 0) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const key = menuKeyForPath(pathname);
    if (key && effectiveHidden.includes(key)) redirect("/dashboard");
  }

  const displayName = user.user_metadata?.full_name ?? user.email ?? "";

  return (
    <AppShell userEmail={displayName} role={role} hiddenMenus={effectiveHidden}>
      {children}
    </AppShell>
  );
}
