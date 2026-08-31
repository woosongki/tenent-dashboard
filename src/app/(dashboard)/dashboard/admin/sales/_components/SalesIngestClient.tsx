"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { buildOfflineWithReport, buildOnlineRows, buildOfflineHistWithReport, dedupe } from "@/lib/sales/ingest";
import type { OfflineIngestReport, OfflineHistReport } from "@/lib/sales/ingest";
import { commitSalesChunk, commitOfflineHistChunk, type SalesTable } from "../_actions";

type Kind = "offline" | "online" | "offlineHist";
type DatasetId = "offlineMonth" | "offlineCum" | "onlineMonth" | "onlineCum" | "offlineMonthlyHist";

interface DatasetDef {
  id: DatasetId;
  no: string;          // 파일 번호(5/6/8/9)
  title: string;
  sheets: string;              // 필요한 시트 안내
  table: SalesTable | "sales_offline_monthly_hist";
  kind: Kind;
  periodField?: "ym" | "year"; // hist는 파일에 ym이 내장 → 불필요
}

// 붙여넣기가 아닌 파일 업로드 — 각 시트가 6천~1만 행이라 브라우저 textarea엔 부적합.
// 파싱은 브라우저에서, DB 쓰기는 서버 액션에서 (service_role) — RLS 하드닝으로 브라우저 직접 쓰기가 막힘.
const DATASETS: DatasetDef[] = [
  { id: "offlineMonth", no: "6", title: "오프라인 당월", sheets: "당월매출비교(브랜드) + 26·25년 당월평당(지점)", table: "sales_offline_month", kind: "offline", periodField: "ym" },
  { id: "offlineCum",   no: "5", title: "오프라인 누적", sheets: "누적매출비교(브랜드) + 26·25년 누적평당(지점)", table: "sales_offline_cum", kind: "offline", periodField: "year" },
  { id: "offlineMonthlyHist", no: "5·M", title: "오프라인 월별 이력", sheets: "누적매출비교(브랜드/지점) + 26·25년 누적평당(브랜드/지점) — 6시트 통합", table: "sales_offline_monthly_hist", kind: "offlineHist" },
  { id: "onlineMonth",  no: "9", title: "온라인 당월", sheets: "26·25년 …당월_지점", table: "sales_online_monthly", kind: "online", periodField: "ym" },
  { id: "onlineCum",    no: "8", title: "온라인 누적", sheets: "26·25년 누적_지점", table: "sales_online_cum", kind: "online", periodField: "year" },
];

type DbRow = Record<string, string | number>;
/**
 * 미리보기 경고. danger = 그대로 확정하면 화면 수치가 깨짐(면적 0 → 일평당매출 0),
 * caution = 확인 권장. 파싱 자체는 성공하므로 확정을 막지는 않고 눈에 보이게만 한다.
 */
interface Warn { level: "danger" | "caution"; text: string }
interface Parsed {
  rows: DbRow[];
  count: number;
  currentLabel: string;
  currentSum: number;
  warnings: Warn[];
  years?: string[]; // hist 전용 — 확정 시 year-scoped delete 대상
}
type Result = { ok: true; parsed: Parsed } | { ok: false; error: string };
type Phase = "idle" | "done" | "error";

const prevYm = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
const won = (n: number) => n.toLocaleString("ko-KR");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};
// 평시 면적 결측률은 10~15%(신규·미등록 지점). 그 이상이면 시트 조인이 깨진 신호.
const AREA_MISS_DANGER = 50;
const AREA_MISS_CAUTION = 25;

/**
 * 오프라인(5·6) 미리보기 경고.
 * 배경: 2026-08 당월 업로드에서 26년 평당(지점) 시트가 시트명 규칙(‘26년’+‘평당’+‘지점’)에
 * 걸리지 않아 전용면적·매장수가 6,024행 전부 0으로 적재됐는데, 행수·매출합만 보이는 미리보기라
 * 아무 신호 없이 확정까지 통과했다. 그 조용한 결측을 여기서 드러낸다.
 */
function offlineWarnings(rep: OfflineIngestReport, cur: string, prev: string, isMonth: boolean): Warn[] {
  const w: Warn[] = [];
  const sheets = rep.sheetNames.join(" · ");
  if (!rep.pyeongCurSheet) {
    w.push({ level: "danger", text: `당기(${rep.yyCur}년) 평당(지점) 시트를 찾지 못했습니다 → ${cur} 전용면적·매장수가 전 행 0으로 적재되고 일평당매출이 0이 됩니다. 시트명에 “${rep.yyCur}년”·“평당”·“지점”이 모두 들어가야 합니다. 파일 내 시트: ${sheets}` });
  } else {
    const p = pct(rep.curAreaMiss, rep.curRows);
    if (p >= AREA_MISS_DANGER) w.push({ level: "danger", text: `${cur} 전용면적 결측 ${p}% (${won(rep.curRows)}행 중 ${won(rep.curAreaMiss)}행) — 시트 ‘${rep.pyeongCurSheet}’ 와 매출비교 시트의 지점·브랜드 표기가 어긋난 것으로 보입니다.` });
    else if (p >= AREA_MISS_CAUTION) w.push({ level: "caution", text: `${cur} 전용면적 결측 ${p}% (${won(rep.curRows)}행 중 ${won(rep.curAreaMiss)}행) — 평시(10~15%)보다 높습니다. 시트 ‘${rep.pyeongCurSheet}’ 확인 권장.` });
  }
  if (!rep.pyeongPrevSheet) {
    w.push({ level: "caution", text: `전기(${rep.yyPrev}년) 평당(지점) 시트 미검출 → ${prev} 면적 0. 일평당매출 성장율이 계산되지 않습니다. 파일 내 시트: ${sheets}` });
  } else if (pct(rep.prevAreaMiss, rep.prevRows) >= AREA_MISS_DANGER) {
    w.push({ level: "caution", text: `${prev}(전기) 전용면적 결측 ${pct(rep.prevAreaMiss, rep.prevRows)}% — 일평당매출 성장율이 과대 계산될 수 있습니다.` });
  }
  if (isMonth && rep.cumDays == null) {
    w.push({ level: "caution", text: `“N일누적” 표기를 찾지 못해 ${cur}을 캘린더 말일 ${daysInMonth(cur)}일로 계산합니다. 월중 스냅샷 파일이면 일평당매출이 실제보다 낮게 나옵니다. (파일명이 아니라 시트명 또는 시트 상단 8행에 “30일누적”처럼 적혀 있어야 인식)` });
  }
  return w;
}

/** 월별 이력(5·M) 미리보기 경고 — 면적은 26/25년 누적평당(브랜드) 시트에서만 온다. */
function histWarnings(rep: OfflineHistReport): Warn[] {
  const w: Warn[] = [];
  const sheets = rep.sheetNames.join(" · ");
  if (!rep.pyeong26Sheet || !rep.pyeong25Sheet) {
    const miss = [!rep.pyeong26Sheet && "26년", !rep.pyeong25Sheet && "25년"].filter(Boolean).join("·");
    w.push({ level: "danger", text: `${miss} 누적평당(브랜드) 시트를 찾지 못했습니다 → 해당 연도 전용면적·매장수가 0으로 적재됩니다. 파일 내 시트: ${sheets}` });
  }
  const p = pct(rep.areaMiss, rep.rows);
  if (p >= AREA_MISS_DANGER) w.push({ level: "danger", text: `전용면적 결측 ${p}% (${won(rep.rows)}행 중 ${won(rep.areaMiss)}행) — 평당 시트 조인이 깨졌을 수 있습니다.` });
  else if (p >= AREA_MISS_CAUTION) w.push({ level: "caution", text: `전용면적 결측 ${p}% (${won(rep.rows)}행 중 ${won(rep.areaMiss)}행) — 평시(10~15%)보다 높습니다.` });
  return w;
}

async function parseDataset(def: DatasetDef, file: File, monthYm: string, cumYear: string): Promise<Parsed> {
  const arrbuf = await file.arrayBuffer();
  if (def.kind === "offlineHist") {
    // 파일에 (브랜드×지점×월) 통째로 담김. ym은 각 행이 자체 보유 → monthYm/cumYear 무시.
    const { rows: raw, report } = buildOfflineHistWithReport(arrbuf);
    const rows: DbRow[] = raw.map((r) => ({
      division: r.division, cat: r.cat, brand: r.brand, store: r.store,
      year: r.year, ym: r.ym,
      sales: r.sales, gp: r.gp, area_raw: r.area_raw, store_cnt: r.store_cnt,
    }));
    const years = [...new Set(rows.map((r) => r.year as string))].sort();
    // 감지된 최신 연도 · 마감월(가장 큰 ym) — 미리보기 라벨과 매출합 기준
    const maxYm = rows.reduce((mx, r) => ((r.ym as string) > mx ? (r.ym as string) : mx), "");
    const latestYear = years[years.length - 1] ?? "";
    const monthByYear = new Map<string, number>();
    for (const r of rows) {
      const y = r.year as string;
      const m = Number((r.ym as string).slice(5, 7));
      if (m > (monthByYear.get(y) ?? 0)) monthByYear.set(y, m);
    }
    const label = years.map((y) => `${y.slice(2)}년 1~${monthByYear.get(y) ?? 0}월`).join(" · ") || maxYm;
    const currentSum = rows.filter((r) => r.year === latestYear).reduce((t, r) => t + (r.sales as number), 0);
    return { rows, count: rows.length, currentLabel: label, currentSum, years, warnings: histWarnings(report) };
  }
  // offline / online 는 periodField 필수. 위 hist 브랜치에서 이미 return 되어 여기 도달 시 확정.
  const pf = def.periodField as "ym" | "year";
  if (def.kind === "offline") {
    const cur = pf === "ym" ? monthYm : cumYear;
    const prev = pf === "ym" ? prevYm(monthYm) : String(Number(cumYear) - 1);
    const { rows: raw, report } = buildOfflineWithReport(arrbuf, cur, prev);
    // 당월 파일에서 "N일누적" 파싱된 경우 days 컬럼도 함께 저장. dedupe 시엔 sum 아닌 대표값이 유지되면 OK.
    // 누적 파일: 각 행에 through_ym = `${year}-MM` 저장. MM은 form의 기준월에서 추출.
    //   → 당월 테이블이 다음달로 앞서가도 cumMonths가 정확히 유지됨.
    const monthMm = /^\d{4}-\d{2}$/.test(monthYm) ? monthYm.slice(5, 7) : "";
    const mapped: DbRow[] = raw.map((r) => ({
      division: r.division, cat: r.cat, brand: r.brand, store: r.store,
      [pf]: r.period, sales: r.sales, gp: r.gp, area_raw: r.area_raw, store_cnt: r.store_cnt,
      ...(r.days != null ? { days: r.days } : {}),
      ...(def.table === "sales_offline_cum" && monthMm ? { through_ym: `${r.period}-${monthMm}` } : {}),
    }));
    const rows = dedupe(mapped, ["division", "cat", "brand", "store", pf], ["sales", "gp", "area_raw", "store_cnt"]);
    const currentSum = rows.filter((r) => r[pf] === cur).reduce((t, r) => t + (r.sales as number), 0);
    return { rows, count: rows.length, currentLabel: cur, currentSum, warnings: offlineWarnings(report, cur, prev, pf === "ym") };
  }
  const mode = pf === "ym" ? "month" : "cum";
  const raw = buildOnlineRows(arrbuf, mode);
  const mapped: DbRow[] = raw.map((r) => ({
    division: r.division, cat: r.cat, brand: r.brand, store: r.store, channel: r.channel,
    [pf]: r.label, sales: r.sales,
  }));
  const rows = dedupe(mapped, ["division", "cat", "brand", "store", "channel", pf], ["sales"]);
  const cur = pf === "ym" ? monthYm : cumYear;
  const currentSum = rows.filter((r) => r[pf] === cur).reduce((t, r) => t + (r.sales as number), 0);
  return { rows, count: rows.length, currentLabel: cur, currentSum, warnings: [] };  // 온라인은 면적 개념 없음
}

export default function SalesIngestClient() {
  const now = useMemo(() => new Date(), []);
  const defMonthYm = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 매출은 보통 전월 기준
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [now]);

  const [monthYm, setMonthYm] = useState(defMonthYm);
  const [cumYear, setCumYear] = useState(String(now.getFullYear()));
  const [files, setFiles] = useState<Record<DatasetId, File | null>>({ offlineMonth: null, offlineCum: null, offlineMonthlyHist: null, onlineMonth: null, onlineCum: null });
  const [results, setResults] = useState<Partial<Record<DatasetId, Result>>>({});
  const [progress, setProgress] = useState<Partial<Record<DatasetId, number>>>({});
  const [phase, setPhase] = useState<Partial<Record<DatasetId, Phase>>>({});
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const validMonth = /^\d{4}-\d{2}$/.test(monthYm);
  const validYear = /^\d{4}$/.test(cumYear);
  const selectedDefs = DATASETS.filter((d) => files[d.id]);
  const parsedOk = DATASETS.filter((d) => results[d.id]?.ok);
  const anyError = DATASETS.some((d) => results[d.id] && !results[d.id]!.ok);
  // 파싱 결과 0행이면 확정 시 테이블만 통째로 비워지는 사일런트 실패가 발생. 확정을 막는다.
  const emptyParsed = DATASETS.filter((d) => {
    const r = results[d.id];
    return r?.ok && r.parsed.count === 0;
  });
  const hasEmptyParsed = emptyParsed.length > 0;
  const dangerCount = DATASETS.reduce((t, d) => {
    const r = results[d.id];
    return t + (r?.ok ? r.parsed.warnings.filter((w) => w.level === "danger").length : 0);
  }, 0);
  const canParse = selectedDefs.length > 0 && validMonth && validYear && !parsing && !committing;
  const canCommit = parsedOk.length > 0 && !anyError && !hasEmptyParsed && !parsing && !committing;

  function setFile(id: DatasetId, f: File | null) {
    setFiles((p) => ({ ...p, [id]: f }));
    setResults((p) => ({ ...p, [id]: undefined }));   // 파일 바뀌면 이전 파싱결과 무효화
    setPhase((p) => ({ ...p, [id]: undefined }));
    setProgress((p) => ({ ...p, [id]: undefined }));
  }

  async function handlePreview() {
    setParsing(true);
    const next: Partial<Record<DatasetId, Result>> = {};
    for (const def of selectedDefs) {
      try {
        const parsed = await parseDataset(def, files[def.id]!, monthYm, cumYear);
        next[def.id] = { ok: true, parsed };
      } catch (e) {
        next[def.id] = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    setResults(next);
    setParsing(false);
    const bad = Object.values(next).filter((r) => r && !r.ok).length;
    const danger = Object.values(next).reduce((t, r) => t + (r?.ok ? r.parsed.warnings.filter((w) => w.level === "danger").length : 0), 0);
    const caution = Object.values(next).reduce((t, r) => t + (r?.ok ? r.parsed.warnings.filter((w) => w.level === "caution").length : 0), 0);
    if (bad) toast.error(`${bad}개 파일 파싱 실패 — 아래 오류 확인`);
    else if (danger) toast.error(`파싱은 됐지만 심각한 경고 ${danger}건 — 이대로 확정하면 화면 수치가 깨집니다. 아래 경고 확인`);
    else if (caution) toast.warning(`파싱 완료 · 확인 필요 경고 ${caution}건 — 아래 내용 확인 후 확정하세요`);
    else toast.success(`${selectedDefs.length}개 파일 파싱 완료 · 합계를 확인 후 확정하세요`);
  }

  async function handleCommit() {
    const targets = DATASETS.filter((d) => results[d.id]?.ok);
    const summary = targets.map((d) => {
      const p = (results[d.id] as { parsed: Parsed }).parsed;
      const scope = d.kind === "offlineHist" && p.years?.length ? ` (${p.years.join("·")}년 교체)` : "";
      return `· ${d.no}. ${d.title} → ${won(p.count)}행${scope}`;
    }).join("\n");
    // 미리보기 경고를 확정 직전에 한 번 더 — 화면 경고를 지나친 채 확정되는 것을 막는다.
    const warnLines = targets.flatMap((d) => {
      const p = (results[d.id] as { parsed: Parsed }).parsed;
      return p.warnings.map((w) => `${w.level === "danger" ? "🚨" : "⚠"} [${d.no}.${d.title}] ${w.text}`);
    });
    const warnBlock = warnLines.length ? `\n\n── 경고 ${warnLines.length}건 ──\n${warnLines.join("\n\n")}\n` : "";
    if (!window.confirm(`아래 테이블을 교체합니다.\n일반 데이터셋은 전체 삭제 후 재삽입, 월별 이력은 파일에 담긴 연도만 교체.\n\n${summary}${warnBlock}\n진행할까요?`)) return;

    setCommitting(true);
    for (const def of targets) {
      const parsed = (results[def.id] as { ok: true; parsed: Parsed }).parsed;
      setPhase((p) => ({ ...p, [def.id]: "idle" }));
      setProgress((p) => ({ ...p, [def.id]: 0 }));
      try {
        // 0행은 상위 canCommit 가드로 이미 차단됨. 방어적으로 스킵 (UI 우회 방지).
        if (parsed.rows.length === 0) throw new Error("파싱 0행 — 확정을 스킵합니다");
        const C = 500;
        for (let i = 0; i < parsed.rows.length; i += C) {
          const chunk = parsed.rows.slice(i, i + C);
          // hist: 첫 청크에서 파일에 담긴 연도만 삭제 — 그 외 과거 연도는 보존.
          const res = def.kind === "offlineHist"
            ? await commitOfflineHistChunk(chunk, { resetYears: i === 0 ? (parsed.years ?? []) : [] })
            : await commitSalesChunk(def.table as SalesTable, chunk, { reset: i === 0 });
          if (!res.ok) throw new Error(`@${i}행: ${res.error}`);
          setProgress((p) => ({ ...p, [def.id]: Math.min(i + C, parsed.rows.length) }));
        }
        setPhase((p) => ({ ...p, [def.id]: "done" }));
      } catch (e) {
        setPhase((p) => ({ ...p, [def.id]: "error" }));
        toast.error(`${def.title}: ${e instanceof Error ? e.message : String(e)}`);
        setCommitting(false);
        return;   // 한 테이블 실패 시 중단 — 나머지는 사용자가 재시도
      }
    }
    setCommitting(false);
    toast.success("매출 데이터 갱신 완료 — 매출분석 페이지에 즉시 반영됩니다");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 기준 기간 */}
      <div className="brutal bg-white p-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/60">기준월 (당월)</span>
          <input
            value={monthYm} onChange={(e) => setMonthYm(e.target.value.trim())} placeholder="2026-06"
            className={`w-[130px] border-[2px] px-2.5 py-1.5 font-mono text-[13px] font-bold outline-none ${validMonth ? "border-[#0a0a0a]" : "border-rose-500"}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/60">누적 기준연도</span>
          <input
            value={cumYear} onChange={(e) => setCumYear(e.target.value.trim())} placeholder="2026"
            className={`w-[100px] border-[2px] px-2.5 py-1.5 font-mono text-[13px] font-bold outline-none ${validYear ? "border-[#0a0a0a]" : "border-rose-500"}`}
          />
        </label>
        <p className="text-[11px] font-bold text-[#0a0a0a]/55 max-w-[420px]">
          당월 파일(6·9)은 <b>기준월</b>, 누적 파일(5·8)은 <b>누적연도</b> 기준으로 적재됩니다. 전년 동기는 자동 계산.
          <br/><b>5·M(월별 이력)</b>은 파일에서 연도·월을 자체 파싱 → 위 입력값 무시.
        </p>
      </div>

      {/* 파일 5개 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {DATASETS.map((def) => {
          const res = results[def.id];
          const ph = phase[def.id];
          const prog = progress[def.id];
          return (
            <div key={def.id} className="brutal bg-white p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 min-w-6 items-center justify-center border-[2px] border-[#0a0a0a] bg-yellow-300 px-1 text-[12px] font-black">{def.no}</span>
                <span className="text-[14px] font-extrabold">{def.title}</span>
                <code className="ml-auto text-[10px] font-bold text-[#0a0a0a]/45">{def.table}</code>
              </div>
              <p className="text-[11px] font-bold text-[#0a0a0a]/55">필요 시트: {def.sheets}</p>
              <input
                type="file" accept=".xlsx"
                onChange={(e) => setFile(def.id, e.target.files?.[0] ?? null)}
                className="text-[12px] font-bold file:mr-2 file:border-[2px] file:border-[#0a0a0a] file:bg-white file:px-2 file:py-1 file:text-[12px] file:font-bold hover:file:bg-yellow-300"
              />
              {res && res.ok && res.parsed.count > 0 && (
                <div className="mt-1 border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-2.5 py-1.5 text-[12px] font-bold">
                  <span className="font-mono">{won(res.parsed.count)}</span>행 · {res.parsed.currentLabel} 매출합{" "}
                  <span className="font-mono">{won(res.parsed.currentSum)}</span>원
                  <span className="block text-[10px] text-[#0a0a0a]/55">원본 ‘전체 결과’ 행과 대조해 확인하세요</span>
                </div>
              )}
              {res?.ok && res.parsed.warnings.map((w, i) => (
                <div
                  key={i}
                  className={`border-[2px] px-2.5 py-1.5 text-[11px] font-bold leading-relaxed ${
                    w.level === "danger"
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-[#0a0a0a] bg-yellow-300 text-[#0a0a0a]"
                  }`}
                >
                  {w.level === "danger" ? "🚨 " : "⚠ "}{w.text}
                </div>
              ))}
              {res && res.ok && res.parsed.count === 0 && (
                <div className="mt-1 border-[2px] border-rose-500 bg-rose-50 px-2.5 py-1.5 text-[12px] font-bold text-rose-700">
                  ⚠ 파싱 결과 0행 — 이 상태로 확정하면 <code className="text-[11px]">{def.table}</code> {def.kind === "offlineHist" ? "대상 연도" : "테이블"}이 비워집니다. 파일이 올바른지, 기준월/연도가 맞는지 확인 후 다시 파싱하세요.
                </div>
              )}
              {def.kind === "offlineHist" && res?.ok && res.parsed.years && res.parsed.years.length > 0 && (
                <p className="text-[10px] font-bold text-[#0a0a0a]/55">
                  확정 시 <b>{res.parsed.years.join(", ")}</b>년 행만 삭제 후 재삽입 (그 외 과거 연도 보존)
                </p>
              )}
              {res && !res.ok && (
                <div className="mt-1 border-[2px] border-rose-500 bg-rose-50 px-2.5 py-1.5 text-[12px] font-bold text-rose-700">⚠ {res.error}</div>
              )}
              {ph && (
                <div className={`mt-1 text-[12px] font-extrabold ${ph === "done" ? "text-emerald-700" : ph === "error" ? "text-rose-700" : "text-[#0a0a0a]/70"}`}>
                  {ph === "done" ? "✅ 적재 완료" : ph === "error" ? "❌ 실패" : `⏳ 적재중 ${won(prog ?? 0)}행…`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 액션 */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handlePreview} disabled={!canParse}
          className="border-[2px] border-[#0a0a0a] bg-white px-4 py-2 text-[13px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-colors hover:bg-yellow-300 disabled:opacity-40 disabled:shadow-none"
        >
          {parsing ? "파싱중…" : "① 미리보기 · 검증"}
        </button>
        <button
          onClick={handleCommit} disabled={!canCommit}
          className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-4 py-2 text-[13px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
        >
          {committing ? "적재중…" : "② 확정 업로드 (DB 통째 교체)"}
        </button>
        {parsedOk.length > 0 && !anyError && !hasEmptyParsed && dangerCount === 0 && (
          <span className="text-[12px] font-bold text-[#0a0a0a]/60">{parsedOk.length}개 파일 검증됨 — 확정 시 즉시 반영</span>
        )}
        {dangerCount > 0 && (
          <span className="text-[12px] font-extrabold text-rose-700">
            🚨 심각 경고 {dangerCount}건 — 확정은 가능하지만 전용면적·일평당매출이 0으로 표시됩니다
          </span>
        )}
        {hasEmptyParsed && (
          <span className="text-[12px] font-extrabold text-rose-700">
            ⚠ {emptyParsed.map((d) => `${d.no}.${d.title}`).join(", ")} 파싱 0행 — 확정 차단됨
          </span>
        )}
      </div>

      <p className="text-[11px] font-bold text-[#0a0a0a]/45 leading-relaxed">
        파일을 올리는 즉시 서버로 전송되지 않습니다. 브라우저에서 파싱·검증 후, ‘확정’을 눌러야 각 테이블을 통째로 교체합니다.
        일부 파일만 올려 해당 데이터셋만 갱신할 수도 있습니다.
      </p>
    </div>
  );
}
