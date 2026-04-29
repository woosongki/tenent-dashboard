import { createClient } from "@supabase/supabase-js";
import type { UploadResult } from "@/types/excel";

const BUCKET = "excel-uploads";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Supabase Storage에 Excel 파일을 업로드하고 경로와 URL을 반환합니다.
 * orgId 기반으로 경로를 분리하여 테넌트 간 격리합니다.
 */
export async function uploadExcelToStorage(
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  orgId: string,
): Promise<UploadResult> {
  const supabase = getServiceClient();

  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uploadPath = `${orgId}/${timestamp}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(uploadPath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(uploadPath);

  return {
    uploadPath,
    publicUrl: urlData?.publicUrl ?? null,
  };
}
