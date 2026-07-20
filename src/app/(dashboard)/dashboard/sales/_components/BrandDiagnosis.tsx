"use client";

import { useMemo, useState } from "react";
import type { OffRank } from "@/lib/sales/queries";
import { diagnoseBrand, type Label, type ExternalSignal, type CohortStat } from "@/lib/sales/diagnose";
import DecompositionView from "./DecompositionView";

const LABEL_STYLE: Record<Label, string> = {
  사실: "bg-slate-200 text-slate-700",
  계산: "bg-slate-200 text-slate-700",
  해석: "bg-sky-100 text-sky-800",
  가설: "bg-violet-100 text-violet-800",
  확인필요: "bg-amber-100 text-amber-800",
  질문: "bg-yellow-300 text-[#0a0a0a]",
};

interface BrandKeywordResult {
  total: number;
  priceStats: { min: number | null; avg: number | null; max: number | null };
  uniqueSellers: number;
  relatedKeywords: { keyword: string; count: number }[];
  categories: { name: string; count: number; pct: number }[];
}

export default function BrandDiagnosis({ row, periodLabel, asOf, subLabel = "지점", cohort = null }: {
  row: OffRank; periodLabel: string; asOf: string; subLabel?: string; cohort?: CohortStat | null;
}) {
  const [external, setExternal] = useState<ExternalSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const diag = useMemo(
    () => diagnoseBrand(row, { periodLabel, asOf, external, subLabel, cohort }),
    [row, periodLabel, asOf, external, subLabel, cohort],
  );

  async function loadExternal() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/brand-keyword", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: row.key }),
      });
      if (!res.ok) { setErr(`외부 신호 조회 실패 (${res.status})`); return; }
      const r = (await res.json()) as BrandKeywordResult;
      setExternal({
        total: r.total,
        priceMin: r.priceStats.min, priceAvg: r.priceStats.avg, priceMax: r.priceStats.max,
        uniqueSellers: r.uniqueSellers,
        relatedKeywords: r.relatedKeywords,
        categories: r.categories,
      });
    } catch { setErr("외부 신호 조회 중 오류"); }
    finally { setLoading(false); }
  }

  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white p-3" style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[12px] font-extrabold">🔍 {row.key} 진단 <span className="font-normal text-slate-400">· 룰 기반(데이터만)</span></div>
        {!external && (
          <button onClick={loadExternal} disabled={loading}
            className="border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[11px] font-bold hover:bg-yellow-100 disabled:opacity-50">
            {loading ? "조회 중…" : "외부 신호 불러오기(네이버)"}
          </button>
        )}
      </div>
      {err && <div className="mb-2 text-[11px] text-rose-600">{err}</div>}

      <div className="space-y-2.5">
        {diag.sections.map((sec) => (
          <div key={sec.title}>
            <div className="mb-1 text-[11px] font-extrabold text-[#0a0a0a]">{sec.title}</div>
            <div className="flex flex-col gap-1">
              {sec.lines.map((ln, i) => (
                <div key={i} className="flex gap-1.5 text-[12px] leading-relaxed">
                  <span className={`mt-0.5 h-fit shrink-0 px-1 py-0.5 text-[9px] font-extrabold ${LABEL_STYLE[ln.label]}`}>{ln.label}</span>
                  <span className="whitespace-pre-line text-[#0a0a0a]">{ln.text}</span>
                </div>
              ))}
            </div>
            {sec.title === "2) 분해" && diag.decomposition && (
              <div className="mt-1.5">
                <DecompositionView decomp={diag.decomposition} subLabel={subLabel} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2.5 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">데이터 기준시점: {diag.asOf} · 외부 신호는 네이버 쇼핑(상관 관찰)</div>
    </div>
  );
}
