import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "인증 오류 — Gana" };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">인증 오류</h1>
        <p className="text-sm text-gray-500">
          {message ?? "알 수 없는 오류가 발생했습니다."}
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
