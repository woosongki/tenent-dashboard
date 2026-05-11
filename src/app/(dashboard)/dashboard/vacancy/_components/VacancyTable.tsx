"use client";

import { useMemo, useState } from "react";
import {
  type VacancyRow,
  STAGE_BADGE,
  CATEGORY_BADGE,
  isResolvedRow,
} from "@/lib/vacancy";
import { TOKENS } from "@/lib/tokens";

interface Props {
  rows: VacancyRow[];
}

const STAGES = ["전체", "1단계", "2단계", "3단계", "4단계"] as const;

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
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                stage === s
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              담당 카테고리: {c}
            </option>
          ))}
        </select>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/60 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
          <input
            type="checkbox"
            checked={resolvedOnly}
            onChange={(e) => setResolvedOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-violet-600"
          />
          공실해결 KPI만 (리징·리빙 × 3·4단계)
        </label>

        <div className="ml-auto">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지점·브랜드·메모 검색"
            className="w-64 rounded-lg border border-slate-200 px-3 py-1.5 text-xs placeholder-slate-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        총 <span className="font-semibold text-slate-700 tabular-nums">{filtered.length.toLocaleString()}</span>건
        {filtered.length !== rows.length && (
          <> · 전체 {rows.length.toLocaleString()}건 중 필터 적용</>
        )}
      </p>

      {/* ── 표 ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70">
              <tr>
                <th className={TOKENS.th}>지점</th>
                <th className={TOKENS.th}>기존 브랜드</th>
                <th className={TOKENS.th}>대안 브랜드</th>
                <th className={`${TOKENS.th} text-right`}>면적(PY)</th>
                <th className={TOKENS.th}>담당 카테고리</th>
                <th className={TOKENS.th}>진척사항</th>
                <th className={TOKENS.th}>MD 의견</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400">
                    조건에 맞는 행이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const resolved = isResolvedRow(r);
                  return (
                    <tr
                      key={`${r.branch}-${r.floor ?? ""}-${r.currentBrand ?? ""}-${i}`}
                      className={`transition-colors hover:bg-slate-50 ${
                        resolved ? "bg-violet-50/30" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <div className="font-medium text-slate-800">{r.branch}</div>
                        {r.floor && (
                          <div className="text-[11px] text-slate-400">{r.floor}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {r.currentBrand ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.altBrands.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.altBrands.map((b, idx) => (
                              <span
                                key={`${b}-${idx}`}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                              >
                                {idx === 0 ? "1안 " : "2안 "}
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700">
                        {r.areaPy != null ? r.areaPy.toFixed(1) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.category ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              CATEGORY_BADGE[r.category] ?? CATEGORY_BADGE["기타"]
                            }`}
                          >
                            {r.category}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.stage ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              STAGE_BADGE[r.stage] ?? "bg-slate-50 text-slate-500 border-slate-200"
                            }`}
                          >
                            {r.stage}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.mdOpinion ? (
                          <span className="line-clamp-2 text-[12px]" title={r.mdOpinion}>
                            {r.mdOpinion}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
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
