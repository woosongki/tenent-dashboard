"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  success?: string;
} | null;

export async function signInAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "이메일 인증을 완료해주세요. 받은 편지함을 확인하세요." };
    }
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signUpAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해주세요." };
  if (password.length < 8) return { error: "비밀번호는 최소 8자 이상이어야 합니다." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "이미 사용 중인 이메일입니다." };
    }
    return { error: error.message };
  }

  return { success: "인증 이메일을 발송했습니다. 받은 편지함을 확인해주세요." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInWithOAuthAction(provider: "google" | "github") {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      queryParams: provider === "google" ? { access_type: "offline", prompt: "consent" } : undefined,
    },
  });

  if (error) return { error: error.message };
  if (data.url) redirect(data.url);
}
