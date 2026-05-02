import "server-only";
import fs from "node:fs";
import path from "node:path";

const FLOORPLAN_DIR = path.join(process.cwd(), "public", "floorplans");
const EXTS = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".svg"];

export interface FloorplanFile {
  storeId: string;
  filename: string;       // 예: "o2001-junggye.png"
  publicPath: string;     // 예: "/floorplans/o2001-junggye.png"
  ext: string;            // 예: ".png"
  isPdf: boolean;
  sizeKB: number;
  mtime: string;          // ISO
}

/** public/floorplans/ 폴더에 존재하는 도면 파일을 storeId 별로 인덱싱. */
export function getFloorplanIndex(): Record<string, FloorplanFile> {
  const index: Record<string, FloorplanFile> = {};
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(FLOORPLAN_DIR);
  } catch {
    return index;
  }

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (!EXTS.includes(ext)) continue;
    const storeId = path.basename(entry, ext);
    if (!storeId || storeId.startsWith(".")) continue;

    const full = path.join(FLOORPLAN_DIR, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }

    index[storeId] = {
      storeId,
      filename: entry,
      publicPath: `/floorplans/${entry}`,
      ext,
      isPdf: ext === ".pdf",
      sizeKB: Math.round(stat.size / 1024),
      mtime: stat.mtime.toISOString(),
    };
  }

  return index;
}
