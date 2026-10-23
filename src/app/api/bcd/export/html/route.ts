/**
 * GET /api/bcd/export/html  (승인 사용자)
 *
 * 브랜드컨셉등급(BCD) 탭을 단독 HTML 파일 1개로 내려준다 — 로그인·네트워크 없이 열리는
 * 읽기 전용 스냅샷(공유·보고용). 점수는 화면과 같은 서버 채점(loadScored)을 그대로 쓴다.
 */
import { requireApproved } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";
import { loadScored } from "@/lib/bcd/data";
import { bcdExportFilename, renderBcdHtml, type ExportBrand } from "@/lib/bcd/export-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  try {
    // 화면과 동일한 로스터(활성 외 범위까지) + 활성 기준 채점.
    const sb = createServiceClient();
    const [scored, brandsRes] = await Promise.all([
      loadScored(),
      sb.from("bcd_brands")
        .select("id, name, category_major, category_minor, scope_status")
        .order("name", { ascending: true }),
    ]);
    if (brandsRes.error) throw new Error(brandsRes.error.message);

    const generatedAt = new Date().toISOString();
    const html = renderBcdHtml({
      ruleset: scored.ruleset,
      brands: (brandsRes.data ?? []) as ExportBrand[],
      scores: scored.scores,
      generatedAt,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${bcdExportFilename(generatedAt)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "내보내기 실패" }, { status: 500 });
  }
}
