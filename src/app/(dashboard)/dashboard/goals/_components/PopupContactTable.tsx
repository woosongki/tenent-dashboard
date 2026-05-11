"use client";

import { useMemo, useState } from "react";
import {
  type PopupContact,
  STAGE_ORDER,
} from "@/lib/popupContacts";
import Badge, { FIELD_TONE, STAGE_TONE, GRADE_TONE } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  rows: PopupContact[];
  importedAt: string;
  /** contactNo → 핀된 주차 인덱스 배열 (52주 캘린더 역참조) */
  pinsByContact?: Record<number, number[]>;
}

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
function weekIdxToLabel(idx: number) {
  // index 0..47, 매월 4주 가정: month = floor(idx/4), week = idx%4 + 1
  const m = Math.floor(idx / 4);
  const w = (idx % 4) + 1;
  return `${MONTHS[m] ?? ""} ${w}주`;
}

const FIELD_OPTIONS = ["F&B", "패션", "리빙", "뷰티", "IP", "체험/전시"];
const GRADE_OPTIONS = ["A", "B", "N"];

export default function PopupContactTable({ rows, importedAt, pinsByContact = {} }: Props) {
  const [stage, setStage] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [q, setQ]         = useState("");

  const filtered = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (stage && r.stage !== stage) return false;
      if (field && r.field !== field) return false;
      if (grade && r.grade !== grade) return false;
      if (qNorm) {
        const hay = `${r.brand} ${r.company ?? ""} ${r.contactName ?? ""} ${r.reference ?? ""}`.toLowerCase();
        if (!hay.includes(qNorm)) return false;
      }
      return true;
    });
  }, [rows, stage, field, grade, q]);

  const stageCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const s of STAGE_ORDER) acc[s] = 0;
    for (const r of rows) if (r.stage) acc[r.stage] = (acc[r.stage] ?? 0) + 1;
    return acc;
  }, [rows]);

  return (
    <div className="space-y-3">
      {/* 단계 칩 */}
      <div className="flex flex-wrap gap-1.5">
        <Chip active={!stage} onClick={() => setStage(null)}>
          전체 {rows.length}
        </Chip>
        {STAGE_ORDER.map((s) => (
          <Chip key={s} active={stage === s} onClick={() => setStage(stage === s ? null : s)}>
            {s} {stageCounts[s] ?? 0}
          </Chip>
        ))}
      </div>

      {/* 분야/등급/검색 */}
      <div className="flex flex-wrap items-center gap-2">
        <SelectChip
          label="분야"
          value={field}
          onChange={setField}
          options={FIELD_OPTIONS}
        />
        <SelectChip
          label="등급"
          value={grade}
          onChange={setGrade}
          options={GRADE_OPTIONS}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="브랜드·업체·담당자 검색"
          className="ml-auto h-8 w-64 rounded-lg border-[2px] border-[#0a0a0a] bg-white px-3 text-[12px] placeholder:text-[#0a0a0a]/55 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      {/* 표 */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="overflow-hidden brutal bg-white">
          <table className="min-w-[960px] w-full text-[13px]">
            <thead className="text-[11px] tracking-tight text-[#0a0a0a]/65 bg-[#F1ECDB] border-b border-[#0a0a0a]/10">
              <tr>
                <th className="text-left py-2 px-3 font-medium w-12">No.</th>
                <th className="text-left py-2 px-3 font-medium">브랜드</th>
                <th className="text-left py-2 px-3 font-medium">업체명</th>
                <th className="text-left py-2 px-3 font-medium">분야</th>
                <th className="text-left py-2 px-3 font-medium w-12">등급</th>
                <th className="text-left py-2 px-3 font-medium">진행 단계</th>
                <th className="text-left py-2 px-3 font-medium">담당자</th>
                <th className="text-left py-2 px-3 font-medium">레퍼런스</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="조건에 맞는 컨택 자료가 없습니다"
                      description="필터를 초기화하거나 검색어를 다시 입력해 보세요."
                      namedIcon="search"
                      size="sm"
                      inline
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.no} className="border-b border-[#0a0a0a]/10 last:border-0 hover:bg-slate-50/60">
                    <td className="py-2 px-3 tabular-nums text-[#0a0a0a]/55 font-medium">{r.no}</td>
                    <td className="py-2 px-3 font-medium text-[#0a0a0a]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.brand}
                        {r.isFirstPage && (
                          <span className="text-[10px] text-violet-600" title="1페지">★</span>
                        )}
                        {(pinsByContact[r.no] ?? []).slice(0, 3).map((wi) => (
                          <a
                            key={wi}
                            href={`/dashboard/calendar`}
                            className="inline-flex items-center text-[9.5px] px-1 py-0 rounded border border-amber-200 bg-amber-50 text-amber-700 hover:underline"
                            title={`52주 캘린더 ${weekIdxToLabel(wi)}에 핀됨`}
                          >
                            📍 {weekIdxToLabel(wi)}
                          </a>
                        ))}
                        {(pinsByContact[r.no]?.length ?? 0) > 3 && (
                          <span className="text-[9.5px] text-[#0a0a0a]/55 font-medium">
                            +{(pinsByContact[r.no]?.length ?? 0) - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-[#0a0a0a]/80">{r.company ?? "-"}</td>
                    <td className="py-2 px-3">
                      {r.field ? (
                        <Badge tone={FIELD_TONE[r.field] ?? "neutral"} size="xs">{r.field}</Badge>
                      ) : (
                        <span className="text-[#0a0a0a]/30">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {r.grade ? (
                        <Badge tone={GRADE_TONE[r.grade] ?? "neutral"} size="xs" variant={r.grade === "A" ? "soft" : "outline"}>
                          <span className="font-semibold">{r.grade}</span>
                        </Badge>
                      ) : (
                        <span className="text-[#0a0a0a]/30">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {r.stage ? (
                        <Badge tone={STAGE_TONE[r.stage] ?? "neutral"} size="sm" variant="dot">{r.stage}</Badge>
                      ) : (
                        <span className="text-[#0a0a0a]/30">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-[#0a0a0a]/80">
                      {r.manager ?? "-"}
                      {r.contactName && <span className="text-[#0a0a0a]/55 font-medium"> · {r.contactName}</span>}
                    </td>
                    <td className="py-2 px-3 text-[#0a0a0a]/65 max-w-[280px] truncate" title={r.reference ?? ""}>
                      {r.reference ?? "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-[#0a0a0a]/55 font-medium">
        총 {rows.length}건 중 {filtered.length}건 표시 · 출처: 💫이랜드리테일 콘텐츠팝업팀 - 팝업 컨텍판 ·
        가져오기 {new Date(importedAt).toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white border-[#0a0a0a] text-[#0a0a0a] hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function SelectChip({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border-[2px] border-[#0a0a0a] bg-white pl-3 pr-1 py-1 text-[12px]">
      <span className="text-[#0a0a0a]/65">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-transparent text-[#0a0a0a] focus:outline-none pr-2"
      >
        <option value="">전체</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
