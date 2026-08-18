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

// ── 오프라인 월별 이력 (5.특정(누적)_DB 파일 → sales_offline_monthly_hist) ─
// 이 파일은 기존 5번(연 누적) 이 아니라 "누적 파일 안에 월별 컬럼(1~마감월)까지 담긴" 신규 포맷.
// 6개 시트: 누적매출비교(브랜드/지점) + 26/25 누적평당(브랜드/지점).
// 매출/이익 = 매출비교 시트(원본), 면적/매장수 = 누적평당 시트(원본). 시트3의 매출은 검증용.

export interface OfflineMonthlyHistRow {
  division: string; cat: string; brand: string; store: string;
  year: string;    // 'YYYY'
  ym: string;      // 'YYYY-MM'
  sales: number; gp: number;
  area_raw: number;   // 평·일 (실면적 × 해당월 일수)
  store_cnt: number;
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

type HistMetric = "sales" | "gp" | "area" | "store_cnt";
interface HistColDef { metric: HistMetric; ym: string; col: number }

function normHistMetric(s: string, kind: "main" | "pyeong"): HistMetric | null {
  const t = s.replace(/\s+/g, "");
  if (kind === "main") {
    if (t === "총매출액") return "sales";
    if (t === "매출총이익") return "gp";
    return null;
  }
  if (t === "전용면적") return "area";
  if (t === "매장수") return "store_cnt";
  // "총매출액"·"일평당매출"·"일평당이익"은 pyeong 시트에서 무시 — 매출/이익은 main, 일평당은 앱에서 재계산.
  return null;
}

interface HistLeaf {
  division: string; cat: string; brand: string; store: string; ym: string;
  sales?: number; gp?: number; area?: number; store_cnt?: number;
}

/**
 * 5.특정(누적) 파일의 한 시트 → leaf 행(월별). kind로 헤더 구조(main=4행 / pyeong=3행) 구분.
 * main:   r4=지표 / r5=조회구간(YYYY-01-01·성장율) / r6=월(1~12·전체 결과) / r7=라벨
 * pyeong: r4=지표 / r5=YYYY-MM·전체 결과 / r6=라벨
 */
function parseHistSheet(ws: XLSX.WorkSheet | undefined, kind: "main" | "pyeong"): HistLeaf[] {
  if (!ws) return [];
  const rows = toGrid(ws);
  // 라벨 헤더 행 탐색 — 첫 컬럼이 "구매그룹…" 또는 "플랜트"
  let h = -1;
  for (let i = 0; i < 12; i++) {
    const v = rows[i]?.[0];
    if (typeof v === "string" && (v.startsWith("구매그룹") || v === "플랜트")) { h = i; break; }
  }
  if (h < 0) return [];

  // 라벨 컬럼 위치(코드/이름 쌍) — 시트별 순서 대응
  const labelRow = rows[h];
  let groupCol = -1, brandCol = -1, storeCol = -1;
  for (let c = 0; c < labelRow.length; c++) {
    const v = labelRow[c];
    if (typeof v !== "string") continue;
    if (groupCol < 0 && v.startsWith("구매그룹")) groupCol = c;
    else if (brandCol < 0 && (v === "브랜드" || v.startsWith("브랜드"))) brandCol = c;
    else if (storeCol < 0 && (v === "플랜트" || v.startsWith("지점"))) storeCol = c;
  }
  if (groupCol < 0 || brandCol < 0 || storeCol < 0) return [];

  // 컬럼 매핑 생성 (main: h-3/h-2/h-1 세 헤더, pyeong: h-2/h-1 두 헤더)
  const cols: HistColDef[] = [];
  const width = Math.max(...[h - 3, h - 2, h - 1].map((r) => rows[r]?.length ?? 0));
  for (let c = 6; c < width; c++) {
    if (kind === "main") {
      const mr = rows[h - 3]?.[c];
      const pr = rows[h - 2]?.[c];
      const mo = rows[h - 1]?.[c];
      if (typeof mr !== "string" || typeof pr !== "string" || mo == null) continue;
      if (pr.includes("성장율")) continue;
      const ym4 = pr.match(/^(\d{4})-\d{2}-\d{2}$/);
      if (!ym4) continue;
      const month = String(mo).replace(/\s+/g, "");
      if (!/^\d{1,2}$/.test(month)) continue;
      const metric = normHistMetric(mr, "main");
      if (!metric) continue;
      cols.push({ metric, ym: `${ym4[1]}-${String(Number(month)).padStart(2, "0")}`, col: c });
    } else {
      const mr = rows[h - 2]?.[c];
      const ymRaw = rows[h - 1]?.[c];
      if (typeof mr !== "string" || ymRaw == null) continue;
      const ymStr = String(ymRaw).trim();
      if (!/^\d{4}-\d{2}$/.test(ymStr)) continue;
      const metric = normHistMetric(mr, "pyeong");
      if (!metric) continue;
      cols.push({ metric, ym: ymStr, col: c });
    }
  }
  if (cols.length === 0) return [];

  const out: HistLeaf[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const gCode = r[groupCol], gName = r[groupCol + 1];
    const bCode = r[brandCol], bName = r[brandCol + 1];
    const sCode = r[storeCol], sName = r[storeCol + 1];
    // 소계·잡행 필터
    if (!bName || bCode === "결과" || bName === "지정되지 않음" || bCode === "#") continue;
    if (!sName || sCode === "결과" || sName === "전체 결과" || sCode === "#") continue;

    const division = divisionOf(String(gCode || ""));
    const cat = String(gName || "").trim();
    const brand = normalizeBrand(String(bName).trim());
    const store = normalizeStore(String(sName).trim());

    // ym별 지표 그룹
    const byYm = new Map<string, { sales?: number; gp?: number; area?: number; store_cnt?: number }>();
    for (const cd of cols) {
      const v = Number(r[cd.col] ?? 0);
      if (!v) continue;
      const e = byYm.get(cd.ym) ?? {};
      e[cd.metric] = v;
      byYm.set(cd.ym, e);
    }
    for (const [ym, v] of byYm) {
      out.push({ division, cat, brand, store, ym, ...v });
    }
  }
  return out;
}

/**
 * 5.특정(누적)_DB 파일 → (브랜드×지점×월) 이력 행.
 * 매출/이익은 "누적매출비교(브랜드)" 시트, 면적/매장수는 "26/25년 누적평당(브랜드)" 시트에서.
 * area_raw는 평·일(실면적 × 해당월 일수)로 변환해 저장.
 */
export function buildOfflineMonthlyHistRows(buf: ArrayBuffer): OfflineMonthlyHistRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const mainName = wb.SheetNames.find((n) => n.includes("누적매출비교") && n.includes("브랜드"));
  if (!mainName) throw new Error("‘누적매출비교(브랜드)’ 시트를 찾지 못했습니다. 5.특정(누적) 신규 포맷 파일인지 확인하세요.");
  const pyeong26 = wb.SheetNames.find((n) => n.includes("26년") && n.includes("누적평당") && n.includes("브랜드"));
  const pyeong25 = wb.SheetNames.find((n) => n.includes("25년") && n.includes("누적평당") && n.includes("브랜드"));

  const mainRows = parseHistSheet(wb.Sheets[mainName], "main");
  const pyeongRows = [
    ...parseHistSheet(wb.Sheets[pyeong26 ?? ""], "pyeong"),
    ...parseHistSheet(wb.Sheets[pyeong25 ?? ""], "pyeong"),
  ];

  // 면적/매장수 맵 (division|cat|brand|store|ym)
  const areaMap = new Map<string, { area?: number; store_cnt?: number }>();
  for (const r of pyeongRows) {
    const k = `${r.division}|${r.cat}|${r.brand}|${r.store}|${r.ym}`;
    const e = areaMap.get(k) ?? {};
    if (r.area != null) e.area = r.area;
    if (r.store_cnt != null) e.store_cnt = r.store_cnt;
    areaMap.set(k, e);
  }

  const out: OfflineMonthlyHistRow[] = [];
  for (const r of mainRows) {
    const sales = r.sales ?? 0;
    const gp = r.gp ?? 0;
    if (!sales && !gp) continue;
    const k = `${r.division}|${r.cat}|${r.brand}|${r.store}|${r.ym}`;
    const a = areaMap.get(k);
    const days = daysInMonth(r.ym);
    out.push({
      division: r.division, cat: r.cat, brand: r.brand, store: r.store,
      year: r.ym.slice(0, 4), ym: r.ym,
      sales: Math.round(sales), gp: Math.round(gp),
      area_raw: Math.round((a?.area ?? 0) * days),
      store_cnt: Math.round(a?.store_cnt ?? 0),
    });
  }
  return out;
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
