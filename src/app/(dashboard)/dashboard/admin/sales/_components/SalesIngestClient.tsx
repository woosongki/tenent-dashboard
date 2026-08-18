"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { buildOfflineRows, buildOnlineRows, buildOfflineMonthlyHistRows, dedupe } from "@/lib/sales/ingest";
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
interface Parsed {
  rows: DbRow[];
  count: number;
  currentLabel: string;
  currentSum: number;
  years?: string[]; // hist 전용 — 확정 시 year-scoped delete 대상
}
type Result = { ok: true; parsed: Parsed } | { ok: false; error: string };
type Phase = "idle" | "done" | "error";

const prevYm = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
const won = (n: number) => n.toLocaleString("ko-KR");

async function parseDataset(def: DatasetDef, file: File, monthYm: string, cumYear: string): Promise<Parsed> {
  const arrbuf = await file.arrayBuffer();
  if (def.kind === "offlineHist") {
    // 파일에 (브랜드×지점×월) 통째로 담김. ym은 각 행이 자체 보유 → monthYm/cumYear 무시.
    const raw = buildOfflineMonthlyHistRows(arrbuf);
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
    return { rows, count: rows.length, currentLabel: label, currentSum, years };
  }
  // offline / online 는 periodField 필수. 위 hist 브랜치에서 이미 return 되어 여기 도달 시 확정.
  const pf = def.periodField as "ym" | "year";
  if (def.kind === "offline") {
    const cur = pf === "ym" ? monthYm : cumYear;
    const prev = pf === "ym" ? prevYm(monthYm) : String(Number(cumYear) - 1);
    const raw = buildOfflineRows(arrbuf, cur, prev);
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
    return { rows, count: rows.length, currentLabel: cur, currentSum };
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
  return { rows, count: rows.length, currentLabel: cur, currentSum };
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
    if (bad) toast.error(`${bad}개 파일 파싱 실패 — 아래 오류 확인`);
    else toast.success(`${selectedDefs.length}개 파일 파싱 완료 · 합계를 확인 후 확정하세요`);
  }

  async function handleCommit() {
    const targets = DATASETS.filter((d) => results[d.id]?.ok);
    const summary = targets.map((d) => {
      const p = (results[d.id] as { parsed: Parsed }).parsed;
      const scope = d.kind === "offlineHist" && p.years?.length ? ` (${p.years.join("·")}년 교체)` : "";
      return `· ${d.no}. ${d.title} → ${won(p.count)}행${scope}`;
    }).join("\n");
    if (!window.confirm(`아래 테이블을 교체합니다.\n일반 데이터셋은 전체 삭제 후 재삽입, 월별 이력은 파일에 담긴 연도만 교체.\n\n${summary}\n\n진행할까요?`)) return;

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
        {parsedOk.length > 0 && !anyError && !hasEmptyParsed && (
          <span className="text-[12px] font-bold text-[#0a0a0a]/60">{parsedOk.length}개 파일 검증됨 — 확정 시 즉시 반영</span>
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
