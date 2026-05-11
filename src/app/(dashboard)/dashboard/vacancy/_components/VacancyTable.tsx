"use client";

import { useMemo, useState } from "react";
import {
  type VacancyRow,
  isResolvedRow,
} from "@/lib/vacancy";

interface Props {
  rows: VacancyRow[];
}

const STAGES = ["전체", "1단계", "2단계", "3단계", "4단계"] as const;

// 진척 단계 brutalist 컬러
const STAGE_BG: Record<string, string> = {
  "1단계": "bg-[#F1ECDB] text-[#0a0a0a]",
  "2단계": "bg-cyan-400 text-cyan-950",
  "3단계": "bg-yellow-300 text-[#0a0a0a]",
  "4단계": "bg-emerald-400 text-emerald-950",
};

// 카테고리 brutalist
const CAT_BG: Record<string, string> = {
  "리징": "bg-violet-500 text-white",
  "리빙": "bg-fuchsia-400 text-white",
  "기타": "bg-[#F1ECDB] text-[#0a0a0a]",
};

export default function VacancyTable({ rows }: Props) {
  const [stage, setStage] = useState<(typeof STAGES)[number]>("전체");
  const [category, setCategory] = useState<string>("전체");
  const [resolvedOnly, setResolvedOnly] = useState(false);
  const [q, setQ] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.category) set.add(r.category);
    return ["전체", ...[...set].sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim();
    return rows.filter((r) => {
      if (stage !== "전체" && r.stage !== stage) return false;
      if (category !== "전체" && r.category !== category) return false;
      if (resolvedOnly && !isResolvedRow(r)) return false;
      if (needle) {
        const hay = [
          r.branch,
          r.currentBrand ?? "",
          ...r.altBrands,
          r.note ?? "",
          r.mdOpinion ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, stage, category, resolvedOnly, q]);

  return (
    <div className="space-y-4">
      {/* ── 필터 바 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] transition-all ${
                stage === s
                  ? "bg-[#0a0a0a] text-white shadow-[2px_2px_0_0_#0a0a0a]"
                  : "bg-white text-[#0a0a0a] hover:bg-yellow-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_0_#0a0a0a] transition-all"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              담당: {c}
            </option>
          ))}
        </select>

        <label className={`inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] border-[#0a0a0a] transition-all ${
          resolvedOnly
            ? "bg-violet-500 text-white shadow-[2px_2px_0_0_#0a0a0a]"
            : "bg-white text-[#0a0a0a] hover:bg-yellow-300"
        }`}>
          <input
            type="checkbox"
            checked={resolvedOnly}
            onChange={(e) => setResolvedOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-violet-600"
          />
          KPI만 (리징·리빙 × 3·4단계)
        </label>

        <div className="ml-auto">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지점·브랜드·메모 검색"
            className="h-9 w-64 border-[2px] border-[#0a0a0a] bg-white px-3 text-[12px] font-medium placeholder:text-[#0a0a0a]/40 shadow-[2px_2px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_0_#0a0a0a] transition-all"
          />
        </div>
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
        총 <span className="font-mono font-extrabold text-[#0a0a0a]">{filtered.length.toLocaleString()}</span>건
        {filtered.length !== rows.length && (
          <> · 전체 <span className="font-mono">{rows.length.toLocaleString()}</span>건 중 필터 적용</>
        )}
      </p>

      {/* ── 표 ── */}
      <div className="overflow-hidden brutal bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-[2px] border-[#0a0a0a] bg-[#F1ECDB]">
              <tr>
                <TH>지점</TH>
                <TH>기존 브랜드</TH>
                <TH>대안 브랜드</TH>
                <TH align="right">면적(PY)</TH>
                <TH>담당 카테고리</TH>
                <TH>진척사항</TH>
                <TH>MD 의견</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[12px] font-bold uppercase tracking-wider text-[#0a0a0a]/40">
                    조건에 맞는 행이 없습니다
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const resolved = isResolvedRow(r);
                  const zebra = i % 2 === 1 ? "bg-[#FAF7EC]/40" : "bg-white";
                  return (
                    <tr
                      key={`${r.branch}-${r.floor ?? ""}-${r.currentBrand ?? ""}-${i}`}
                      className={`border-b border-[#0a0a0a]/10 transition-colors hover:bg-yellow-100 ${
                        resolved ? "bg-violet-50/40" : zebra
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-extrabold text-[#0a0a0a]">{r.branch}</div>
                        {r.floor && (
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">{r.floor}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-[#0a0a0a]/80">
                        {r.currentBrand ?? <span className="text-[#0a0a0a]/25">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.altBrands.length === 0 ? (
                          <span className="text-[#0a0a0a]/25">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {r.altBrands.map((b, idx) => (
                              <span
                                key={`${b}-${idx}`}
                                className="inline-flex items-center gap-1 border-[1.5px] border-[#0a0a0a] bg-white px-1.5 py-0 text-[11px] font-bold text-[#0a0a0a]"
                              >
                                <span className="font-mono text-[9px] font-extrabold text-[#0a0a0a]/55">{idx === 0 ? "1안" : "2안"}</span>
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums font-extrabold text-[#0a0a0a]">
                        {r.areaPy != null ? r.areaPy.toFixed(1) : <span className="text-[#0a0a0a]/25">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.category ? (
                          <span
                            className={`inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider ${
                              CAT_BG[r.category] ?? CAT_BG["기타"]
                            }`}
                          >
                            {r.category}
                          </span>
                        ) : (
                          <span className="text-[#0a0a0a]/25">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.stage ? (
                          <span
                            className={`inline-block border-[1.5px] border-[#0a0a0a] px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider ${
                              STAGE_BG[r.stage] ?? "bg-[#F1ECDB] text-[#0a0a0a]"
                            }`}
                          >
                            {r.stage}
                          </span>
                        ) : (
                          <span className="text-[#0a0a0a]/25">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[300px] text-[11px] font-medium text-[#0a0a0a]/70">
                        {r.mdOpinion ? (
                          <span className="line-clamp-2" title={r.mdOpinion}>
                            {r.mdOpinion}
                          </span>
                        ) : (
                          <span className="text-[#0a0a0a]/25">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TH({
  children, align = "left",
}: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-4 py-3 ${a} text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] whitespace-nowrap`}>
      {children}
    </th>
  );
}
