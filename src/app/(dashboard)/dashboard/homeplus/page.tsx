import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "홈플 이슈맵 — lifestyle" };

export default async function HomeplusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="h-screen w-full overflow-hidden">
      <iframe
        src="/homeplus-map.html"
        className="h-full w-full border-0"
        title="홈플러스 영업중단 × 이랜드리테일 상권 분석 지도"
      />
    </div>
  );
}
