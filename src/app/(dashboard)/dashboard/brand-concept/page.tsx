import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import { loadScored, type BrandRow } from "@/lib/bcd/data";
import BrandConceptClient, { type ListRow } from "./_components/BrandConceptClient";

export const metadata: Metadata = { title: "브랜드컨셉등급(BCD) — lifestyle" };

// 매 요청마다 최신 등급 — 지표 입력 직후 재채점 반영.
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { console.error("[brand-concept] 로드 실패:", e); return null; }
}

export default async function BrandConceptPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members").select("role").eq("user_id", user.id).limit(1).maybeSingle();
  const role = membership?.role as "owner" | "admin" | "member" | undefined;
  const canEdit = role === "owner" || role === "admin";

  // 활성 브랜드 채점 + 전체 로스터(제외·거래불가 포함)를 병렬 로드. 테이블 미적용 시 safe→null.
  const scored = await safe(() => loadScored());
  const allBrands = await safe(async () => {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("bcd_brands")
      .select("id, name, category_major, category_minor, online_applicable, scope_status")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as BrandRow[];
  });

  const lists = await safe(async () => {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("bcd_lists")
      .select("id, list_type, name, match_strings, is_full_survey")
      .in("list_type", ["benchmark", "hotspot"])
      .order("list_type", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ListRow[];
  });

  const ready = scored !== null || allBrands !== null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "브랜드컨셉등급" }]} />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="BRAND CONCEPT DEGREE"
            title="브랜드컨셉등급(BCD)"
            subtitle="라이프스타일 부문 브랜드를 8개 지표(C1~C8)로 채점해 A/B+/B/C/N 등급으로 정리. 기준(ruleset)은 버전 관리."
            meta={scored?.ruleset ? `활성 기준 · 브랜드 ${allBrands?.length ?? 0}개` : "기준(ruleset) 미적용"}
          />
          {ready ? (
            <BrandConceptClient
              ruleset={scored?.ruleset ?? null}
              brands={allBrands ?? []}
              scores={scored?.scores ?? []}
              lists={lists ?? []}
              canEdit={canEdit}
            />
          ) : (
            <div className="border-[2px] border-dashed border-slate-300 p-10 text-center text-[13px] text-slate-400">
              BCD 테이블이 아직 없습니다. <code className="text-[11px]">supabase/bcd_schema.sql</code> → <code className="text-[11px]">supabase/bcd_seed.sql</code>을 SQL Editor에서 실행하세요.
            </div>
          )}
          <AppFooter />
        </div>
      </main>
    </div>
  );
}
