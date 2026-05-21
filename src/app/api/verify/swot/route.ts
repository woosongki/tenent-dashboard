import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDisclosures, fetchCompanyInfo } from "@/lib/verify/dart";
import { findLatestReportRcept, fetchReportText } from "@/lib/verify/dartDocument";
import { analyzeBusinessSwot } from "@/lib/verify/analyzer";

export const runtime = "nodejs";
export const maxDuration = 120;

interface SwotRequest {
  companyName: string;
  corpCode: string;
}

export async function POST(req: NextRequest) {
  // T5-1 권한 게이트 (메인과 동일)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "인증 필요" }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const role = membership?.role;
  if (role !== "owner" && role !== "admin") {
    return Response.json({ error: "owner/admin만 SWOT 분석을 실행할 수 있습니다" }, { status: 403 });
  }

  const body = (await req.json()) as SwotRequest;
  if (!body.companyName?.trim() || !body.corpCode?.trim()) {
    return Response.json({ error: "companyName, corpCode 필요" }, { status: 400 });
  }

  try {
    // 1. 보고서 찾기 (disclosures 새로 fetch + company info for corpCls)
    const [companyInfo, disclosures] = await Promise.all([
      fetchCompanyInfo(body.corpCode),
      fetchDisclosures(body.corpCode),
    ]);

    const reportRcept = await findLatestReportRcept(
      body.corpCode,
      companyInfo?.corpCls ?? null,
      disclosures
    );

    if (!reportRcept) {
      return Response.json({
        error: "DART에서 사업보고서·감사보고서를 찾을 수 없습니다",
        notFound: true,
      }, { status: 404 });
    }

    // 2. 본문 텍스트 (8K 제한)
    const bodyText = await fetchReportText(reportRcept.rceptNo, 8000);
    if (!bodyText || bodyText.length < 300) {
      return Response.json({
        error: "본문 텍스트를 추출할 수 없습니다 (스캔 이미지 PDF 등)",
        reportInfo: reportRcept,
      }, { status: 422 });
    }

    // 3. Haiku로 SWOT 분석 (~$0.005)
    const swot = await analyzeBusinessSwot({
      companyName: body.companyName,
      reportType: reportRcept.type,
      reportDate: reportRcept.date,
      bodyText,
    });

    if (!swot) {
      return Response.json({ error: "SWOT 추출 실패" }, { status: 500 });
    }

    return Response.json({ swot, bodyChars: bodyText.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
