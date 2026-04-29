import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseExcelBuffer, validateFile, ExcelParseError } from "@/lib/excel/parser";
import { uploadExcelToStorage } from "@/lib/excel/storage";
import type { ExcelApiResponse, ParseOptions } from "@/types/excel";

function err(message: string, status: number, detail?: string): NextResponse<ExcelApiResponse> {
  return NextResponse.json({ ok: false, error: message, detail } as ExcelApiResponse, { status });
}

/** 현재 로그인 유저의 조직 ID를 반환 (organization_members에서 첫 번째 조직) */
async function getOrgId(request: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );

  const orgId = request.headers.get("x-organization-id");
  if (!orgId) return null;

  // 해당 조직의 멤버인지 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  return data?.organization_id ?? null;
}

export async function POST(request: NextRequest): Promise<NextResponse<ExcelApiResponse>> {
  // ── 1. 인증 확인 ─────────────────────────────
  const orgId = await getOrgId(request);
  if (!orgId) {
    return err("인증이 필요합니다. x-organization-id 헤더를 포함하세요.", 401);
  }

  // ── 2. multipart/form-data 파싱 ───────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return err("multipart/form-data 파싱에 실패했습니다.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return err("'file' 필드가 없거나 유효하지 않습니다.", 400);
  }

  // ── 3. 파일 유효성 검사 ───────────────────────
  try {
    validateFile(file);
  } catch (e) {
    if (e instanceof ExcelParseError) return err(e.message, 422, e.code);
    throw e;
  }

  // ParseOptions를 쿼리스트링에서 읽기
  const url = new URL(request.url);
  const parseOptions: ParseOptions = {
    headerRow: Number(url.searchParams.get("headerRow") ?? 0),
    skipEmptyRows: url.searchParams.get("skipEmptyRows") !== "false",
    dateAsString: url.searchParams.get("dateAsString") !== "false",
    sheetNames: url.searchParams.get("sheets")?.split(",").filter(Boolean) ?? [],
  };

  // ── 4. 파일 → ArrayBuffer ─────────────────────
  const buffer = await file.arrayBuffer();

  // ── 5. Excel 파싱 ─────────────────────────────
  let parseResult;
  try {
    parseResult = await parseExcelBuffer(buffer, file.name, file.size, parseOptions);
  } catch (e) {
    if (e instanceof ExcelParseError) return err(e.message, 422, e.code);
    return err("Excel 파싱 중 오류가 발생했습니다.", 500, String(e));
  }

  // ── 6. Supabase Storage 업로드 ────────────────
  let uploadResult;
  try {
    uploadResult = await uploadExcelToStorage(buffer, file.name, file.type || "application/octet-stream", orgId);
  } catch (e) {
    return err("파일 저장 중 오류가 발생했습니다.", 500, String(e));
  }

  // ── 7. 응답 ───────────────────────────────────
  return NextResponse.json({
    ok: true,
    parse: parseResult,
    upload: uploadResult,
  } as ExcelApiResponse);
}

// GET: 업로드된 파일 목록 조회 (Storage 버킷 목록)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const orgId = await getOrgId(request);
  if (!orgId) return err("인증이 필요합니다.", 401);

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.storage
    .from("excel-uploads")
    .list(orgId, { sortBy: { column: "created_at", order: "desc" } });

  if (error) return err("파일 목록 조회 실패", 500, error.message);

  return NextResponse.json({ ok: true, files: data });
}
