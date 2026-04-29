"use client";

import { useActionState, useState, useTransition } from "react";
import { signInAction, signUpAction, signInWithOAuthAction, type AuthState } from "../_actions/auth";

export default function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [oauthPending, startOAuth] = useTransition();

  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(action, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">

        {/* Logo / Title */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
            <span className="text-lg font-bold text-white">G</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === "signin" ? "로그인" : "회원가입"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {mode === "signin" ? "계정에 로그인하세요" : "새 계정을 만드세요"}
          </p>
        </div>

        {/* OAuth */}
        <div className="space-y-2">
          <button
            type="button"
            disabled={oauthPending}
            onClick={() => startOAuth(() => { void signInWithOAuthAction("google"); })}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <GoogleIcon />
            Google로 계속하기
          </button>
          <button
            type="button"
            disabled={oauthPending}
            onClick={() => startOAuth(() => { void signInWithOAuthAction("github"); })}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <GitHubIcon />
            GitHub로 계속하기
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">또는</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Email / Password form */}
        <form action={formAction} className="space-y-4">
          {mode === "signup" && (
            <Field label="이름" name="full_name" type="text" placeholder="홍길동" />
          )}
          <Field label="이메일" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
          <Field label="비밀번호" name="password" type="password" placeholder="••••••••" autoComplete={mode === "signin" ? "current-password" : "new-password"} />

          {/* Error / Success */}
          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          )}
          {state?.success && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">{state.success}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPending ? "처리 중…" : mode === "signin" ? "로그인" : "가입하기"}
          </button>
        </form>

        {/* Mode toggle */}
        <p className="text-center text-sm text-gray-500">
          {mode === "signin" ? (
            <>
              계정이 없으신가요?{" "}
              <button onClick={() => setMode("signup")} className="font-medium text-indigo-600 hover:underline">
                회원가입
              </button>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{" "}
              <button onClick={() => setMode("signin")} className="font-medium text-indigo-600 hover:underline">
                로그인
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  );
}
