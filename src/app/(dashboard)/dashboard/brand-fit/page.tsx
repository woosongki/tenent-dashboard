import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BrandFitClient from "./_components/BrandFitClient";

export const metadata: Metadata = { title: "브랜드 적합도 — lifestyle" };

export default async function BrandFitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <BrandFitClient />;
}
