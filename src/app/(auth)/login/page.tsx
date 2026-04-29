import type { Metadata } from "next";
import AuthForm from "./_components/AuthForm";

export const metadata: Metadata = { title: "로그인 — Gana" };

export default function LoginPage() {
  return <AuthForm />;
}
