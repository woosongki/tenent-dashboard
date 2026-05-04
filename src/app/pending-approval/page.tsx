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

  // 이미 승인됐으면 대시보드로 리다이렉트
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved, rejection_reason")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_approved) redirect("/dashboard");

  const rejected = !!profile?.rejection_reason;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[#e8ecf0] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,.04)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-[18px] font-black text-white shadow-[0_6px_18px_rgba(124,58,237,0.3)]">
          G
        </div>
        <h1 className="mt-5 text-[20px] font-extrabold tracking-tight text-slate-900">
          {rejected ? "접근이 거부되었습니다" : "관리자 승인 대기 중"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          {rejected ? (
            <>
              이 계정은 사용 권한이 없습니다.
              {profile?.rejection_reason && (
                <span className="block mt-1 text-slate-600">사유: {profile.rejection_reason}</span>
              )}
              문의가 필요하면 관리자에게 연락해 주세요.
            </>
          ) : (
            <>
              가입이 완료되었습니다. 관리자가 승인을 완료하면 대시보드에 접근할 수 있습니다.
              <br />
              승인이 완료되면 이 페이지를 새로고침하거나 다시 로그인해 주세요.
            </>
          )}
        </p>

        <dl className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-[12px] space-y-1">
          <div className="flex gap-2">
            <dt className="w-16 text-slate-500">로그인</dt>
            <dd className="flex-1 font-medium text-slate-800 break-all">{user.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 text-slate-500">상태</dt>
            <dd className={`flex-1 font-medium ${rejected ? "text-rose-600" : "text-amber-600"}`}>
              {rejected ? "거부됨" : "승인 대기"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Link
            href="/pending-approval"
            className="text-[12px] text-slate-500 hover:text-slate-800"
          >
            새로고침
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-[12px] font-medium text-white hover:bg-slate-700"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
