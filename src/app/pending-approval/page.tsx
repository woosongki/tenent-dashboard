import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/login/_actions/auth";

export const metadata: Metadata = { title: "승인 대기 — lifestyle" };

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved, rejection_reason")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_approved) redirect("/dashboard");

  const rejected = !!profile?.rejection_reason;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7EC] px-6">
      <div className="w-full max-w-md brutal-lg bg-white p-8">
        {/* Logo */}
        <div className="flex h-12 w-12 items-center justify-center border-[2px] border-[#0a0a0a] bg-yellow-300 text-[18px] font-black text-[#0a0a0a] shadow-[3px_3px_0_0_#0a0a0a]">
          L
        </div>

        {/* Status eyebrow */}
        <span className={`mt-6 inline-block border-[2px] border-[#0a0a0a] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.16em] ${
          rejected ? "bg-rose-500 text-white" : "bg-yellow-300 text-[#0a0a0a]"
        }`}>
          {rejected ? "REJECTED" : "PENDING"}
        </span>

        <h1 className="mt-3 font-display text-[28px] leading-[1.1] text-[#0a0a0a]">
          {rejected ? "접근이 거부되었습니다" : "관리자 승인 대기 중"}
        </h1>

        <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#0a0a0a]/70">
          {rejected ? (
            <>
              이 계정은 사용 권한이 없습니다.
              {profile?.rejection_reason && (
                <span className="block mt-2 border-[2px] border-[#0a0a0a] bg-rose-100 px-3 py-2 text-[12px] font-bold text-rose-700">
                  사유: {profile.rejection_reason}
                </span>
              )}
              <span className="mt-2 block">문의가 필요하면 관리자에게 연락해 주세요.</span>
            </>
          ) : (
            <>
              가입이 완료되었습니다. 관리자가 승인을 완료하면 대시보드에 접근할 수 있습니다.
              <br />
              승인 완료 후 페이지를 새로고침하거나 다시 로그인해 주세요.
            </>
          )}
        </p>

        {/* Info Box */}
        <dl className="mt-6 border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-4 py-3 text-[12px] space-y-1.5">
          <div className="flex gap-3">
            <dt className="w-16 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/70 pt-0.5">로그인</dt>
            <dd className="flex-1 font-mono font-bold text-[#0a0a0a] break-all">{user.email}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-16 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/70 pt-0.5">상태</dt>
            <dd className={`flex-1 font-extrabold uppercase tracking-wider ${rejected ? "text-rose-700" : "text-amber-700"}`}>
              {rejected ? "거부됨" : "승인 대기"}
            </dd>
          </div>
        </dl>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between gap-2">
          <Link
            href="/pending-approval"
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-yellow-300 transition-colors"
          >
            ↻ 새로고침
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[11px] font-extrabold uppercase tracking-wider px-4 py-2 border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] transition-all"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
