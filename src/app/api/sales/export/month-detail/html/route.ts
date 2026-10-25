/**
 * GET /api/sales/export/month-detail/html  (승인 사용자)
 *
 * 매출분석 > 당월상세 탭을 단독 HTML 파일 1개로 내려준다 — 로그인·네트워크 없이 열리는
 * 읽기 전용 스냅샷(공유·보고용). 화면과 같은 쿼리(getOfflineMonth)·같은 계산(lib/sales/detail)을 쓴다.
 */
import { requireApproved } from "@/lib/auth/guards";
import { getOfflineMeta, getOfflineMonth } from "@/lib/sales/queries";
import { renderSalesDetailHtml, salesDetailExportFilename } from "@/lib/sales/export-detail-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 매출분석 페이지와 동일 — 온라인 부문 제외.
const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];

export async function GET() {
  const g = await requireApproved();
  if (!g.ok) return g.response;

  try {
    const meta = await getOfflineMeta();
    if (!meta.monthYm) {
      return Response.json({ error: "당월 데이터가 없습니다. sales_offline_month 테이블을 확인하세요." }, { status: 404 });
    }
    const prevYm = `${Number(meta.monthYm.slice(0, 4)) - 1}${meta.monthYm.slice(4)}`;
    const m = await getOfflineMonth(meta.monthYm, prevYm, OFFLINE_DIVISIONS);

    const generatedAt = new Date().toISOString();
    const html = renderSalesDetailHtml({
      periodLabel: meta.monthYm,
      prevLabel: prevYm,
      brands: m.detailBrands,
      stores: m.stores,
      divisions: m.divisions,
      fashionCats: m.fashionCats,
      others: m.others ?? null,
      monthCount: 1,            // 당월 — 하위 표에 '월평균' 컬럼 없음
      generatedAt,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${salesDetailExportFilename(meta.monthYm, generatedAt)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "내보내기 실패" }, { status: 500 });
  }
}
