import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import MapShell from "./_components/MapShell";

export const metadata: Metadata = { title: "리테일 지도 — lifestyle" };

export default async function HomeplusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <TopBar
        crumbs={[
          { label: "시장·브랜드" },
          { label: "리테일 지도" },
        ]}
      />
      <div className="flex-1 overflow-hidden">
        <MapShell />
      </div>
    </div>
  );
}
