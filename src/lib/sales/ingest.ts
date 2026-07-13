// 매출 ERP 익스포트(xlsx) → Supabase 적재용 행 변환 (서버 전용).
//
// 구 로컬 파이프라인(convert-offline/online-xlsx + import-sales, 현재 제거됨)의
// 파싱 로직을 이관. 이제 앱 업로드 화면(/dashboard/admin/sales)이 이 함수로
// 직접 파싱해 Supabase에 반영한다.
//
// 파일 ↔ 테이블 대응:
//   5.특정(누적)   → buildOfflineRows → sales_offline_cum   (period=year)
//   6.특정(당월)   → buildOfflineRows → sales_offline_month (period=ym)
//   8.온라인(누적) → buildOnlineRows("cum")   → sales_online_cum   (label=year)
//   9.온라인(당월) → buildOnlineRows("month") → sales_online_monthly(label=ym)

import * as XLSX from "xlsx";

type Cell = string | number | boolean | null | undefined;
type Grid = Cell[][];

export interface OfflineRow {
  division: string; cat: string; brand: string; store: string;
  period: string;                       // year('2026') 또는 ym('2026-06')
  sales: number; gp: number; area_raw: number; store_cnt: number;
  days?: number;                        // 당월 파일 "N일누적" 파싱값. 미검출/누적파일=undefined
}
export interface OnlineRow {
  division: string; cat: string; brand: string; store: string;
  channel: string; label: string;       // year('2026') 또는 ym('2026-06')
  sales: number;
}

function toGrid(ws: XLSX.WorkSheet): Grid {
  return XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null });
}

// ── 오프라인 ─────────────────────────────────────────────────────
function divisionOf(code: string): string {
  if (!code) return "기타";
  if (code[0] === "I") return "온라인";
  if (code === "EDA" || code === "EHA") return "F&B";
  if (code[0] === "B") return "패션";
  return "기타"; // E*, F*
}
function findHeader(rows: Grid, first: string): number {
  for (let i = 0; i < 8; i++) if (rows[i] && rows[i][0] === first) return i;
  return -1;
}

// ERP 시트 간 표기 불일치 정규화. 매출비교/평당 시트의 지점/브랜드명이 어긋나
// (store|cat|brand) join 실패 → 당월 dpp매출/면적이 0으로 표시되는 문제 해결.
// 양쪽 시트에 동일 규칙으로 적용하여 canonical 표기로 통일.
const STORE_NAME_ALIAS = new Map<string, string>([
  ["NC대전 유성점", "대전유성점"],
]);
function normalizeStore(name: string): string {
  return STORE_NAME_ALIAS.get(name) ?? name;
}

// 매출비교/평당 시트 간 관측된 브랜드명 불일치. canonical 로 통일해 area 조인 성공.
const BRAND_NAME_ALIAS = new Map<string, string>([
  ["애슐리퀸즈", "애슐리"],
  ["두촌가마솥밥&쭈꾸미", "두촌가마솥밥"],
  ["속초코다리냉면", "속초코다리"],
  ["다솜쥬토피아생태체험관", "다솜쥬토피아생태체험"],
  ["세라", "세라젬"],
  ["아가방", "아가방갤러리"],
  ["뷰티아울렛", "S뷰티아울렛"],
  ["크록스(CROCS)", "크록스"],
  ["포트메리온(PORTMEIRION)", "포트메리온"],
  ["더카페()", "더카페"],
]);
function normalizeBrand(name: string): string {
  const t = name.trim();
  return BRAND_NAME_ALIAS.get(t) ?? t;
}

// 평당(지점) 시트 → (지점|복종|브랜드) → {areaRaw, cnt}
function parsePyeong(ws: XLSX.WorkSheet | undefined): Map<string, { areaRaw: number; cnt: number }> {
  const map = new Map<string, { areaRaw: number; cnt: number }>();
  if (!ws) return map;
  const rows = toGrid(ws);
  const h = findHeader(rows, "플랜트");
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const store = r[1], cat = r[3], bcode = r[4], bname = r[5];
    if (!store || !bname || !bcode || bcode === "결과") continue;
    // ERP 잡행 차단: "지정되지 않음"·"#"(소계/미분류)
    if (bname === "지정되지 않음" || bcode === "#") continue;
    // area_raw/store_cnt은 DB bigint 컬럼이므로 소수값이 들어가지 않도록 반올림.
    const key = `${normalizeStore(String(store))}|${cat}|${normalizeBrand(String(bname))}`;
    const prev = map.get(key);
    // 동일 (store|cat|brand) 중복 시 합산 — ERP가 fit 세분 등으로 여러 행에 나눠 내리는 케이스.
    const areaRaw = Math.round(Number(r[7] || 0)) + (prev?.areaRaw ?? 0);
    const cnt = Math.round(Number(r[10] || 0)) + (prev?.cnt ?? 0);
    map.set(key, { areaRaw, cnt });
  }
  return map;
}

/**
 * (store|brand) 폴백 맵 — 매출비교와 평당의 cat 표기가 다른 케이스(예: 신구로점 다이소는
 * 매출비교=테넌트일반 / 평당=가정문화) 대비. (store|brand) 조합이 평당에서 단일 cat 이면
 * 그 area 를 사용하고, 여러 cat 에 걸치면 모호 → 폴백 미적용.
 */
function pyeongByStoreBrand(pyeong: Map<string, { areaRaw: number; cnt: number }>): Map<string, { areaRaw: number; cnt: number } | null> {
  const buckets = new Map<string, { areaRaw: number; cnt: number; cats: number }>();
  for (const [k, v] of pyeong) {
    const [store, , brand] = k.split("|");
    const sb = `${store}|${brand}`;
    const b = buckets.get(sb);
    if (b) { b.areaRaw += v.areaRaw; b.cnt += v.cnt; b.cats++; }
    else buckets.set(sb, { areaRaw: v.areaRaw, cnt: v.cnt, cats: 1 });
  }
  const out = new Map<string, { areaRaw: number; cnt: number } | null>();
  for (const [k, v] of buckets) out.set(k, v.cats === 1 ? { areaRaw: v.areaRaw, cnt: v.cnt } : null);
  return out;
}

// 매출비교(브랜드) 시트 → leaf 행 (지점 단위 당기/전기 매출·이익)
interface MainRow { division: string; cat: string; brand: string; store: string; sCur: number; sPrev: number; gCur: number; gPrev: number; }
function parseMain(ws: XLSX.WorkSheet): MainRow[] {
  const rows = toGrid(ws);
  const h = findHeader(rows, "구매그룹(Now:손익센터)");
  const out: MainRow[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const gcode = r[0], cat = r[1], bname = r[3], scode = r[4], sname = r[5];
    if (!sname || !scode || scode === "결과" || !String(scode).includes("/") || !bname) continue;
    // 매출비교 시트는 brand_code 위치가 불확실 → brand_name만 필터
    if (bname === "지정되지 않음") continue;
    out.push({
      division: divisionOf(String(gcode || "")), cat: String(cat || "").trim(),
      brand: normalizeBrand(String(bname).trim()), store: normalizeStore(String(sname).trim()),
      sCur: Math.round(Number(r[6] || 0)), sPrev: Math.round(Number(r[7] || 0)),
      gCur: Math.round(Number(r[9] || 0)), gPrev: Math.round(Number(r[10] || 0)),
    });
  }
  return out;
}

function findPyeongSheet(wb: XLSX.WorkBook, yy: string): string | undefined {
  return wb.SheetNames.find((n) => n.includes(`${yy}년`) && n.includes("평당") && n.includes("지점"));
}
function findMainSheet(wb: XLSX.WorkBook): string | undefined {
  return wb.SheetNames.find((n) => n.includes("매출비교") && n.includes("브랜드"));
}

/**
 * "N일누적" 파싱 — 시트명 / 시트 상단 8행 셀 텍스트 순서로 탐색.
 * 당월 파일에 사용자가 "6일누적" 같이 적어두면 그 값을 반환. 없으면 null → 캘린더 말일 fallback.
 */
function parseCumDays(wb: XLSX.WorkBook): number | null {
  const RE = /(\d+)\s*일\s*누적/;
  for (const name of wb.SheetNames) {
    const m = name.match(RE);
    if (m) return Number(m[1]);
  }
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = toGrid(ws);
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      for (const v of rows[i] ?? []) {
        if (typeof v !== "string") continue;
        const m = v.match(RE);
        if (m) return Number(m[1]);
      }
    }
  }
  return null;
}

/**
 * 오프라인 파일(5/6번) 1개 → 당기+전기 행. period 는 'YYYY'(누적) 또는 'YYYY-MM'(당월).
 * @throws 매출비교(브랜드) 시트를 찾지 못하면 에러.
 */
export function buildOfflineRows(buf: ArrayBuffer, periodCur: string, periodPrev: string): OfflineRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const mainSheet = findMainSheet(wb);
  if (!mainSheet) throw new Error("‘매출비교(브랜드)’ 시트를 찾지 못했습니다. 올바른 오프라인 파일인지 확인하세요.");
  const yyCur = periodCur.slice(2, 4);
  const yyPrev = String(Number(yyCur) - 1).padStart(2, "0");
  const main = parseMain(wb.Sheets[mainSheet]);
  const aCur = parsePyeong(wb.Sheets[findPyeongSheet(wb, yyCur) ?? ""]);
  const aPrev = parsePyeong(wb.Sheets[findPyeongSheet(wb, yyPrev) ?? ""]);
  // (store|cat|brand) 미스 시 폴백: 평당의 cat 표기가 매출비교와 달라도 (store|brand) 단일 매칭이면 area 회수.
  const aCurSB = pyeongByStoreBrand(aCur);
  const aPrevSB = pyeongByStoreBrand(aPrev);
  // 당월 파일(periodCur='YYYY-MM')만 "N일누적" 적용. 누적 파일은 이미 ERP가 평·일로 내려줌.
  const isMonth = /^\d{4}-\d{2}$/.test(periodCur);
  const cumDays = isMonth ? parseCumDays(wb) ?? undefined : undefined;

  const rows: OfflineRow[] = [];
  for (const r of main) {
    const k = `${r.store}|${r.cat}|${r.brand}`;
    const sb = `${r.store}|${r.brand}`;
    const pc = aCur.get(k) ?? aCurSB.get(sb) ?? null;
    const pp = aPrev.get(k) ?? aPrevSB.get(sb) ?? null;
    if (r.sCur || r.gCur) rows.push({ division: r.division, cat: r.cat, brand: r.brand, store: r.store, period: periodCur, sales: r.sCur, gp: r.gCur, area_raw: pc ? pc.areaRaw : 0, store_cnt: pc ? pc.cnt : 0, days: cumDays });
    if (r.sPrev || r.gPrev) rows.push({ division: r.division, cat: r.cat, brand: r.brand, store: r.store, period: periodPrev, sales: r.sPrev, gp: r.gPrev, area_raw: pp ? pp.areaRaw : 0, store_cnt: pp ? pp.cnt : 0, days: cumDays });
  }
  return rows;
}

// ── 온라인 ───────────────────────────────────────────────────────
function parseMonthYm(sheetName: string): string | null {
  const m = sheetName.match(/(\d{2})년\s*(\d{1,2})월/);
  if (!m) return null;
  return `20${m[1]}-${String(m[2]).padStart(2, "0")}`;
}
function parseYear(sheetName: string): string | null {
  const m = sheetName.match(/(\d{2})년/);
  return m ? `20${m[1]}` : null;
}

/** 차원 컬럼 자동 감지 (지점/구매그룹/브랜드 헤더 위치). 시트별 순서 차이 대응. */
function detectDimCols(rows: Grid): { store: number; group: number; brand: number } {
  const labels = { store: /지점\s*\(.*\)/, group: /구매그룹\s*\(.*\)/, brand: /브랜드\s*\(.*\)/ };
  const found = { store: -1, group: -1, brand: -1 };
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] || [];
    for (let c = 0; c < r.length; c++) {
      const v = r[c];
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (found.store < 0 && labels.store.test(t)) found.store = c;
      if (found.group < 0 && labels.group.test(t)) found.group = c;
      if (found.brand < 0 && labels.brand.test(t)) found.brand = c;
    }
    if (found.store >= 0 && found.group >= 0 && found.brand >= 0) break;
  }
  return found;
}

/** 지점 시트 1개 → leaf 행. @throws 채널 헤더/컬럼을 못 찾으면 에러. */
function parseStoreSheet(ws: XLSX.WorkSheet): Omit<OnlineRow, "label">[] {
  const rows = toGrid(ws);
  const CHAN_RE = /쿠팡|네이버|11번가|G마켓|옥션|통합몰|하프클럽|E몰|패션플러스/;
  let chanRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] || [];
    if (r.some((v) => typeof v === "string" && CHAN_RE.test(v))) { chanRowIdx = i; break; }
  }
  if (chanRowIdx < 0) throw new Error("채널명 헤더 행을 찾지 못했습니다.");
  const chanRow = rows[chanRowIdx];
  const channels: Record<number, string> = {};
  for (let c = 0; c < chanRow.length; c++) {
    const v = chanRow[c];
    if (!v || typeof v !== "string") continue;
    const t = v.trim();
    if (!t || t === "지정되지 않음" || t === "결과" || t === "#") continue;
    if (!CHAN_RE.test(t)) continue;
    channels[c] = t;
  }
  if (Object.keys(channels).length === 0) throw new Error("채널 컬럼을 추출하지 못했습니다.");

  const dim = detectDimCols(rows);
  const storeCol = dim.store >= 0 ? dim.store + 1 : 1;
  const catCol   = dim.group >= 0 ? dim.group + 1 : 3;
  const bCodeCol = dim.brand >= 0 ? dim.brand     : 4;
  const bNameCol = dim.brand >= 0 ? dim.brand + 1 : 5;

  const out: Omit<OnlineRow, "label">[] = [];
  for (let i = chanRowIdx + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const store = r[storeCol], cat = r[catCol], bCode = r[bCodeCol], bName = r[bNameCol];
    if (!bName || !bCode || bCode === "결과") continue;
    if (!store || store === "전체 결과") continue;
    for (const [c, ch] of Object.entries(channels)) {
      const v = r[Number(c)];
      if (v == null || v === 0) continue;
      out.push({
        division: "패션",
        cat: String(cat || "").trim(),
        brand: normalizeBrand(String(bName).trim()),
        store: normalizeStore(String(store).trim()),
        channel: ch,
        sales: Math.round(Number(v)),
      });
    }
  }
  return out;
}

/**
 * 온라인 파일(8/9번) → 지점 시트별 leaf 행. mode 로 label 종류 결정.
 * @param mode "month" → label=ym('2026-06') · "cum" → label=year('2026')
 */
export function buildOnlineRows(buf: ArrayBuffer, mode: "month" | "cum"): OnlineRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = wb.SheetNames.filter((n) => n.includes("_지점"));
  if (sheets.length === 0) throw new Error("‘_지점’ 시트를 찾지 못했습니다. 올바른 온라인 파일인지 확인하세요.");
  const out: OnlineRow[] = [];
  for (const name of sheets) {
    const label = mode === "month" ? parseMonthYm(name) : parseYear(name);
    if (!label) continue;
    for (const r of parseStoreSheet(wb.Sheets[name])) out.push({ ...r, label });
  }
  return out;
}

// ── 키 충돌 시 합산 (dedupe) ─────────────────────────────────────
export function dedupe<T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[], sumCols: (keyof T)[]): T[] {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = keys.map((c) => r[c]).join("|");
    const e = m.get(k);
    if (e) { for (const sc of sumCols) (e[sc] as number) += r[sc] as number; }
    else m.set(k, { ...r });
  }
  return [...m.values()];
}
