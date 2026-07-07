"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { buildOfflineRows, buildOnlineRows, dedupe } from "@/lib/sales/ingest";
import { commitSalesChunk, type SalesTable } from "../_actions";

type Kind = "offline" | "online";
type DatasetId = "offlineMonth" | "offlineCum" | "onlineMonth" | "onlineCum";

interface DatasetDef {
  id: DatasetId;
  no: string;          // 파일 번호(5/6/8/9)
  title: string;
  sheets: string;      // 필요한 시트 안내
  table: SalesTable;   // Supabase 테이블
  kind: Kind;
  periodField: "ym" | "year";
}

// 붙여넣기가 아닌 파일 업로드 — 각 시트가 6천~1만 행이라 브라우저 textarea엔 부적합.
// 파싱은 브라우저에서, DB 쓰기는 서버 액션에서 (service_role) — RLS 하드닝으로 브라우저 직접 쓰기가 막힘.
const DATASETS: DatasetDef[] = [
  { id: "offlineMonth", no: "6", title: "오프라인 당월", sheets: "당월매출비교(브랜드) + 26·25년 당월평당(지점)", table: "sales_offline_month", kind: "offline", periodField: "ym" },
  { id: "offlineCum",   no: "5", title: "오프라인 누적", sheets: "누적매출비교(브랜드) + 26·25년 누적평당(지점)", table: "sales_offline_cum", kind: "offline", periodField: "year" },
  { id: "onlineMonth",  no: "9", title: "온라인 당월", sheets: "26·25년 …당월_지점", table: "sales_online_monthly", kind: "online", periodField: "ym" },
  { id: "onlineCum",    no: "8", title: "온라인 누적", sheets: "26·25년 누적_지점", table: "sales_online_cum", kind: "online", periodField: "year" },
];

type DbRow = Record<string, string | number>;
interface Parsed { rows: DbRow[]; count: number; currentLabel: string; currentSum: number; }
type Result = { ok: true; parsed: Parsed } | { ok: false; error: string };
type Phase = "idle" | "done" | "error";

const prevYm = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
const won = (n: number) => n.toLocaleString("ko-KR");

async function parseDataset(def: DatasetDef, file: File, monthYm: string, cumYear: string): Promise<Parsed> {
  const arrbuf = await file.arrayBuffer();
  if (def.kind === "offline") {
    const cur = def.periodField === "ym" ? monthYm : cumYear;
    const prev = def.periodField === "ym" ? prevYm(monthYm) : String(Number(cumYear) - 1);
    const raw = buildOfflineRows(arrbuf, cur, prev);
    const mapped: DbRow[] = raw.map((r) => ({
      division: r.division, cat: r.cat, brand: r.brand, store: r.store,
      [def.periodField]: r.period, sales: r.sales, gp: r.gp, area_raw: r.area_raw, store_cnt: r.store_cnt,
    }));
    const rows = dedupe(mapped, ["division", "cat", "brand", "store", def.periodField], ["sales", "gp", "area_raw", "store_cnt"]);
    const currentSum = rows.filter((r) => r[def.periodField] === cur).reduce((t, r) => t + (r.sales as number), 0);
    return { rows, count: rows.length, currentLabel: cur, currentSum };
  }
  const mode = def.periodField === "ym" ? "month" : "cum";
  const raw = buildOnlineRows(arrbuf, mode);
  const mapped: DbRow[] = raw.map((r) => ({
    division: r.division, cat: r.cat, brand: r.brand, store: r.store, channel: r.channel,
    [def.periodField]: r.label, sales: r.sales,
  }));
  const rows = dedupe(mapped, ["division", "cat", "brand", "store", "channel", def.periodField], ["sales"]);
  const cur = def.periodField === "ym" ? monthYm : cumYear;
  const currentSum = rows.filter((r) => r[def.periodField] === cur).reduce((t, r) => t + (r.sales as number), 0);
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
  const [files, setFiles] = useState<Record<DatasetId, File | null>>({ offlineMonth: null, offlineCum: null, onlineMonth: null, onlineCum: null });
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
  const canParse = selectedDefs.length > 0 && validMonth && validYear && !parsing && !committing;
  const canCommit = parsedOk.length > 0 && !anyError && !parsing && !committing;

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
    const summary = targets.map((d) => `· ${d.no}. ${d.title} → ${won((results[d.id] as { parsed: Parsed }).parsed.count)}행`).join("\n");
    if (!window.confirm(`아래 테이블을 통째로 교체합니다 (기존 행 전체 삭제 후 재삽입).\n\n${summary}\n\n진행할까요?`)) return;

    setCommitting(true);
    for (const def of targets) {
      const parsed = (results[def.id] as { ok: true; parsed: Parsed }).parsed;
      setPhase((p) => ({ ...p, [def.id]: "idle" }));
      setProgress((p) => ({ ...p, [def.id]: 0 }));
      try {
        // 빈 행이라도 첫 청크는 reset=true 로 테이블 초기화 (기존 동작 유지).
        if (parsed.rows.length === 0) {
          const res = await commitSalesChunk(def.table, [], { reset: true });
          if (!res.ok) throw new Error(res.error);
        } else {
          const C = 500;
          for (let i = 0; i < parsed.rows.length; i += C) {
            const chunk = parsed.rows.slice(i, i + C);
            const res = await commitSalesChunk(def.table, chunk, { reset: i === 0 });
            if (!res.ok) throw new Error(`@${i}행: ${res.error}`);
            setProgress((p) => ({ ...p, [def.id]: Math.min(i + C, parsed.rows.length) }));
          }
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
        </p>
      </div>

      {/* 파일 4개 */}
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
              {res && res.ok && (
                <div className="mt-1 border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-2.5 py-1.5 text-[12px] font-bold">
                  <span className="font-mono">{won(res.parsed.count)}</span>행 · {res.parsed.currentLabel} 매출합{" "}
                  <span className="font-mono">{won(res.parsed.currentSum)}</span>원
                  <span className="block text-[10px] text-[#0a0a0a]/55">원본 ‘전체 결과’ 행과 대조해 확인하세요</span>
                </div>
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
        {parsedOk.length > 0 && !anyError && (
          <span className="text-[12px] font-bold text-[#0a0a0a]/60">{parsedOk.length}개 파일 검증됨 — 확정 시 즉시 반영</span>
        )}
      </div>

      <p className="text-[11px] font-bold text-[#0a0a0a]/45 leading-relaxed">
        파일을 올리는 즉시 서버로 전송되지 않습니다. 브라우저에서 파싱·검증 후, ‘확정’을 눌러야 각 테이블을 통째로 교체합니다.
        일부 파일만 올려 해당 데이터셋만 갱신할 수도 있습니다.
      </p>
    </div>
  );
}
