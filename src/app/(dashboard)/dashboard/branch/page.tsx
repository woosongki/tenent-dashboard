import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "지점정보 — lifestyle" };

export default async function BranchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "지점정보" }]}
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">지점정보</h1>
          <p className="mt-1 text-[13px] text-slate-400">이랜드리테일 지점 현황 및 상세 정보를 확인하세요</p>
        </div>

        {/* 준비 중 */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#e8ecf0] bg-white py-24 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
            </svg>
          </div>
          <p className="mt-4 text-[15px] font-semibold text-slate-700">지점정보 페이지 준비 중</p>
          <p className="mt-1 text-[13px] text-slate-400">곧 이랜드리테일 지점 현황 데이터를 제공할 예정입니다.</p>
        </div>
      </main>
    </div>
  );
}
