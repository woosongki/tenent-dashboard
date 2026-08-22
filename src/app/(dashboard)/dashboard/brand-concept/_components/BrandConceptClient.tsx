"use client";

import { Fragment, useMemo, useState, useTransition, type TransitionStartFunction } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Ruleset, ScoreResult, CriterionResult, Criterion, CriterionMode } from "@/lib/bcd/score";
import type { BrandRow } from "@/lib/bcd/data";
import { pillBtn, inputCompact, TOKENS } from "@/lib/tokens";
import ScrollHint from "@/components/ui/ScrollHint";
import { registerBrand, saveMetric, setBrandScope, addList, deleteList, saveRuleset } from "../_actions";

export interface ListRow {
  id: string;
  list_type: string;
  name: string;
  match_strings: string[] | null;
  is_full_survey: boolean | null;
}

// ── 등급 표기 ────────────────────────────────────────────────────────────
const GRADE_ORDER = ["A", "B+", "B", "C", "N", "H", "미평가"] as const;
type Grade = (typeof GRADE_ORDER)[number];
const GRADE_STYLE: Record<string, { chip: string; bar: string }> = {
  "A":     { chip: "bg-violet-100 text-violet-800 border-violet-300", bar: "#7c3aed" },
  "B+":    { chip: "bg-emerald-100 text-emerald-800 border-emerald-300", bar: "#0d9e6e" },
  "B":     { chip: "bg-sky-100 text-sky-800 border-sky-300", bar: "#2b6cb0" },
  "C":     { chip: "bg-amber-100 text-amber-800 border-amber-300", bar: "#b7791f" },
  "N":     { chip: "bg-rose-100 text-rose-800 border-rose-300", bar: "#e53e3e" },
  "H":     { chip: "bg-slate-800 text-white border-slate-900", bar: "#0a0a0a" },
  "미평가": { chip: "bg-slate-100 text-slate-600 border-slate-300", bar: "#94a3b8" },
};
const SCOPE_LABEL: Record<string, string> = { excluded: "제외(X)", knockout: "거래불가(H)" };
const NA_REASONS = ["시계열부족", "검색어미확정", "매장미검출", "현장미확인", "표본부족"] as const;

function GradeBadge({ g }: { g: string }) {
  const s = GRADE_STYLE[g] ?? GRADE_STYLE["미평가"];
  return <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-extrabold ${s.chip}`}>{g || "—"}</span>;
}

interface Row {
  b: BrandRow;
  score: ScoreResult | null;
}

type SortKey = "name" | "category" | "grade" | "total" | "naPoints";

export default function BrandConceptClient({
  ruleset, brands, scores, lists, canEdit,
}: {
  ruleset: Ruleset | null;
  brands: BrandRow[];
  scores: ScoreResult[];
  lists: ListRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [majorSel, setMajorSel] = useState<string | null>(null);
  const [gradeSel, setGradeSel] = useState<string | null>(null);
  const [scopeSel, setScopeSel] = useState<"all" | "active" | "excluded" | "knockout">("all");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showLists, setShowLists] = useState(false);
  const [showRuleset, setShowRuleset] = useState(false);
  const [collecting, setCollecting] = useState<null | "kakao" | "naver">(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function runCollect(kind: "kakao" | "naver") {
    const label = kind === "kakao" ? "카카오맵 매장 수집(C1·C2·C3·C6)" : "네이버 검색량 수집(C4·C5)";
    const ids = [...selected];
    const scopeMsg = ids.length ? `선택한 ${ids.length}개 브랜드` : "활성 브랜드 최대 30건";
    if (!window.confirm(`${label}을 ${scopeMsg}에 실행합니다. 외부 API를 호출합니다(비용 발생). 진행할까요?`)) return;
    setCollecting(kind);
    try {
      const res = await fetch(kind === "kakao" ? "/api/bcd/collect/kakao" : "/api/bcd/collect/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids.length ? { brandIds: ids, limit: Math.max(ids.length, 30) } : {}),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "수집 실패"); return; }
      const errN = data.errors?.length ?? 0;
      toast.success(`${label} 완료 · 성공 ${data.brandsOk}/${data.brandsTotal}${errN ? ` · 오류 ${errN}` : ""}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setCollecting(null);
    }
  }

  const scoreById = useMemo(() => new Map(scores.map((s) => [s.brandId, s])), [scores]);
  const critName = useMemo(() => {
    const m = new Map<string, { name: string; weight: number }>();
    if (ruleset) {
      for (const c of ruleset.base) m.set(c.code, { name: c.name, weight: c.weight });
      m.set(ruleset.bonus.code, { name: ruleset.bonus.name, weight: ruleset.bonus.weight });
    }
    return m;
  }, [ruleset]);

  const majors = useMemo(
    () => [...new Set(brands.map((b) => b.category_major).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")),
    [brands]
  );

  const rows: Row[] = useMemo(() => brands.map((b) => ({ b, score: scoreById.get(b.id) ?? null })), [brands, scoreById]);

  // 등급 분포 (활성·채점된 브랜드만)
  const dist = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scores) m.set(s.grade, (m.get(s.grade) ?? 0) + 1);
    return GRADE_ORDER.map((g) => ({ g, n: m.get(g) ?? 0 })).filter((x) => x.n > 0);
  }, [scores]);

  const filtered = useMemo(() => {
    let r = rows;
    if (scopeSel !== "all") r = r.filter((x) => x.b.scope_status === scopeSel);
    if (majorSel) r = r.filter((x) => x.b.category_major === majorSel);
    if (gradeSel) r = r.filter((x) => x.score?.grade === gradeSel);
    if (q) {
      const qq = q.toLowerCase();
      r = r.filter((x) =>
        x.b.name.toLowerCase().includes(qq) ||
        x.b.category_major.toLowerCase().includes(qq) ||
        x.b.category_minor.toLowerCase().includes(qq));
    }
    const mul = dir === "asc" ? 1 : -1;
    const gRank = (g?: string) => (g ? GRADE_ORDER.indexOf(g as Grade) : 99);
    return [...r].sort((a, b) => {
      if (sortKey === "name") return a.b.name.localeCompare(b.b.name, "ko") * mul;
      if (sortKey === "category") return `${a.b.category_major}${a.b.category_minor}`.localeCompare(`${b.b.category_major}${b.b.category_minor}`, "ko") * mul;
      if (sortKey === "grade") return (gRank(a.score?.grade) - gRank(b.score?.grade)) * mul;
      if (sortKey === "naPoints") return ((a.score?.naPoints ?? 0) - (b.score?.naPoints ?? 0)) * mul;
      return ((a.score?.total ?? -1) - (b.score?.total ?? -1)) * mul;
    });
  }, [rows, scopeSel, majorSel, gradeSel, q, sortKey, dir]);

  function toggle(k: SortKey) {
    if (sortKey === k) setDir((x) => (x === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setDir(k === "name" || k === "category" ? "asc" : "desc"); }
  }
  const arrow = (k: SortKey) => (sortKey === k ? (dir === "asc" ? " ▲" : " ▼") : "");

  function onScope(brandId: string, scope: string) {
    startTransition(async () => {
      const res = await setBrandScope(brandId, scope);
      if (res.ok) { toast.success("범위 변경됨"); router.refresh(); }
      else toast.error(res.error);
    });
  }

  const activeCount = rows.filter((r) => r.b.scope_status === "active").length;
  const filteredIds = filtered.map((f) => f.b.id);
  const allSel = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  function toggleSelectAll() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSel) filteredIds.forEach((id) => n.delete(id));
      else filteredIds.forEach((id) => n.add(id));
      return n;
    });
  }

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Kpi label="전체 브랜드" value={brands.length.toLocaleString()} sub={`활성 ${activeCount}개`} />
        <Kpi label="채점 완료" value={scores.length.toLocaleString()} sub={ruleset ? "활성 기준 적용" : "기준 없음"} highlight />
        <Kpi label="A · B+ 등급" value={dist.filter((d) => d.g === "A" || d.g === "B+").reduce((t, d) => t + d.n, 0).toLocaleString()} sub="상위 등급" />
        <Kpi label="N/A 초과(미평가)" value={(scores.filter((s) => s.grade === "미평가").length).toLocaleString()} sub="지표 결측 과다" />
      </div>

      {/* 등급 분포 막대 */}
      {dist.length > 0 && (
        <div className="border-[2px] border-[#0a0a0a] bg-white p-4 shadow-[3px_3px_0_0_#0a0a0a]">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/65">등급 분포 (채점 {scores.length}개)</p>
          <div className="space-y-2">
            {dist.map(({ g, n }) => {
              const max = Math.max(1, ...dist.map((d) => d.n));
              return (
                <div key={g} className="flex items-center gap-2">
                  <span className="w-14 shrink-0"><GradeBadge g={g} /></span>
                  <div className="relative h-4 flex-1 border-[1.5px] border-[#0a0a0a] bg-white">
                    <div className="absolute inset-y-0 left-0" style={{ width: `${(n / max) * 100}%`, background: GRADE_STYLE[g]?.bar ?? "#94a3b8" }} />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[11.5px] font-extrabold tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 등록 · 목록관리 · 자동수집 (관리자) */}
      {canEdit && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowRegister((v) => !v)} className={TOKENS.btn.secondary}>
              {showRegister ? "✕ 닫기" : "＋ 브랜드 등록"}
            </button>
            <button onClick={() => setShowLists((v) => !v)} className={TOKENS.btn.secondary}>
              {showLists ? "✕ 닫기" : "📋 벤치마크·핫플 관리"}
            </button>
            <button onClick={() => setShowRuleset((v) => !v)} className={TOKENS.btn.secondary}>
              {showRuleset ? "✕ 닫기" : "⚙ 기준(C1~C8) 편집"}
            </button>
            <span className="mx-1 h-5 w-px bg-[#0a0a0a]/20" />
            <button onClick={() => runCollect("kakao")} disabled={collecting !== null} className={TOKENS.btn.accent}>
              {collecting === "kakao" ? "수집 중…" : "🗺 카카오맵 수집"}
            </button>
            <button onClick={() => runCollect("naver")} disabled={collecting !== null} className={TOKENS.btn.accent}>
              {collecting === "naver" ? "수집 중…" : "🔍 네이버 검색량 수집"}
            </button>
            <span className="text-[11px] font-bold text-[#0a0a0a]/60">
              {selected.size > 0
                ? <>선택 <b>{selected.size}</b>건만 수집 · <button onClick={() => setSelected(new Set())} className="underline">해제</button></>
                : "선택 없음 → 활성 최대 30건"}
            </span>
          </div>
          {showRegister && <RegisterForm pending={pending} onDone={() => { setShowRegister(false); router.refresh(); }} startTransition={startTransition} />}
          {showLists && <ListManager lists={lists} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />}
          {showRuleset && (ruleset
            ? <RulesetEditor ruleset={ruleset} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
            : <p className="mt-2 text-[12px] text-slate-500">활성 ruleset이 없습니다. bcd_seed.sql을 먼저 적용하세요.</p>)}
        </div>
      )}

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setMajorSel(null)} className={pillBtn(!majorSel)}>전체 부문</button>
        {majors.map((m) => (
          <button key={m} onClick={() => setMajorSel(majorSel === m ? null : m)} className={pillBtn(majorSel === m)}>{m}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "active", "excluded", "knockout"] as const).map((s) => (
            <button key={s} onClick={() => setScopeSel(s)} className={pillBtn(scopeSel === s)}>
              {s === "all" ? "전체" : s === "active" ? "활성" : s === "excluded" ? "제외(X)" : "거래불가(H)"}
            </button>
          ))}
          {gradeSel && (
            <button onClick={() => setGradeSel(null)} className="border-[2px] border-[#0a0a0a] bg-rose-100 px-3 py-1.5 text-[12px] font-bold">
              등급 {gradeSel} ✕
            </button>
          )}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="브랜드·카테고리 검색" className={`${inputCompact} w-full max-w-[240px]`} />
      </div>

      {/* 표 */}
      <ScrollHint className="border-[2px] border-[#0a0a0a] bg-white">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white select-none">
            <tr>
              {canEdit && (
                <th className="px-2 py-2 text-center" title="수집 대상 선택(전체)">
                  <input type="checkbox" checked={allSel} onChange={toggleSelectAll} />
                </th>
              )}
              <th className="px-3 py-2 text-left cursor-pointer hover:bg-white/10 whitespace-nowrap" onClick={() => toggle("name")}>브랜드{arrow("name")}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:bg-white/10 whitespace-nowrap" onClick={() => toggle("category")}>부문·중분류{arrow("category")}</th>
              <th className="px-2 py-2 text-center cursor-pointer hover:bg-white/10" onClick={() => toggle("grade")}>등급{arrow("grade")}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10 whitespace-nowrap" onClick={() => toggle("total")}>총점{arrow("total")}</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">기본·가점</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:bg-white/10 whitespace-nowrap" onClick={() => toggle("naPoints")}>N/A(점){arrow("naPoints")}</th>
              <th className="px-2 py-2 text-center whitespace-nowrap">검색포지션</th>
              {canEdit && <th className="px-2 py-2 text-center whitespace-nowrap">범위</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ b, score }) => {
              const isOpen = expanded === b.id;
              const notActive = b.scope_status !== "active";
              const colSpan = canEdit ? 9 : 7;
              return (
                <Fragment key={b.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : b.id)}
                    className={`border-t border-slate-100 cursor-pointer hover:bg-yellow-50 ${isOpen ? "bg-yellow-100" : ""} ${notActive ? "opacity-60" : ""}`}
                  >
                    {canEdit && (
                      <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleSelect(b.id)} />
                      </td>
                    )}
                    <td className="px-3 py-1.5 font-bold text-[#0a0a0a] whitespace-nowrap">
                      <span className="mr-1 text-[10px] text-[#0a0a0a]/60">{isOpen ? "▾" : "▸"}</span>{b.name}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{b.category_major} · {b.category_minor}</td>
                    <td className="px-2 py-1.5 text-center">
                      {notActive ? <span className="text-[10px] font-bold text-slate-500">{SCOPE_LABEL[b.scope_status] ?? b.scope_status}</span> : <GradeBadge g={score?.grade ?? "미평가"} />}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{score ? score.total : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-500 whitespace-nowrap">{score ? `${score.baseScore}·+${score.bonusScore}` : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: (score?.naPoints ?? 0) > 25 ? "#e53e3e" : "#94a3b8" }}>{score ? score.naPoints : "—"}</td>
                    <td className="px-2 py-1.5 text-center text-[11px] font-bold text-slate-600">{score?.searchPosition ?? "—"}</td>
                    {canEdit && (
                      <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={b.scope_status}
                          disabled={pending}
                          onChange={(e) => onScope(b.id, e.target.value)}
                          className="border border-slate-300 px-1 py-0.5 text-[10px] font-bold outline-none disabled:opacity-50"
                        >
                          <option value="active">활성</option>
                          <option value="excluded">제외(X)</option>
                          <option value="knockout">거래불가(H)</option>
                        </select>
                      </td>
                    )}
                  </tr>
                  {isOpen && (
                    <tr className="bg-[#FAF7EC]">
                      <td colSpan={colSpan} className="px-3 py-3">
                        <Breakdown score={score} critName={critName} />
                        {canEdit && <MetricForm brandId={b.id} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} ruleset={ruleset} />}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={canEdit ? 9 : 7} className="px-3 py-8 text-center text-slate-400">결과 없음</td></tr>
            )}
          </tbody>
        </table>
      </ScrollHint>

      <p className="text-[10px] font-medium text-[#0a0a0a]/55">
        등급 = 8지표(C1~C8) 가중 채점 → 기본 100점 환산 + 가점(C7) − N/A 정책(결측 25점 초과 시 미평가). 기준(ruleset)은 버전 관리 · A/B+/B/C/N 컷은 파일럿 실측 후 재도출 예정.
        {!ruleset && " · 활성 ruleset이 없어 채점이 비어 있습니다(bcd_seed.sql 적용 필요)."}
      </p>
    </div>
  );
}

// ── 채점 상세(브랜드 펼침) ────────────────────────────────────────────────
function Breakdown({ score, critName }: { score: ScoreResult | null; critName: Map<string, { name: string; weight: number }> }) {
  if (!score || Object.keys(score.breakdown).length === 0) {
    return <p className="text-[12px] text-slate-500">채점 상세가 없습니다. {score?.grade === "H" ? "거래불가(H) — 점수 계산 제외." : "지표 값을 입력하면 채점됩니다."}</p>;
  }
  const codes = Object.keys(score.breakdown).sort();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[11px]">
        <thead className="bg-[#F1ECDB] text-[#0a0a0a]">
          <tr>
            <th className="px-2 py-1 text-left">지표</th>
            <th className="px-2 py-1 text-right">원값</th>
            <th className="px-2 py-1 text-right">점수/배점</th>
            <th className="px-2 py-1 text-right">백분위</th>
            <th className="px-2 py-1 text-left">비교군</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => {
            const r: CriterionResult = score.breakdown[code];
            const meta = critName.get(code);
            const isNa = r.score === null;
            return (
              <tr key={code} className="border-t border-slate-200">
                <td className="px-2 py-1 font-bold whitespace-nowrap">{code} {meta?.name ?? ""}</td>
                <td className="px-2 py-1 text-right font-mono">{r.value ?? "—"}</td>
                <td className="px-2 py-1 text-right font-mono" style={{ color: isNa ? "#e53e3e" : "#0a0a0a" }}>
                  {isNa ? "N/A" : `${r.score}/${meta?.weight ?? "?"}`}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-500">{r.rank !== undefined ? `${r.rank}%` : "—"}</td>
                <td className="px-2 py-1 text-left text-slate-500 whitespace-nowrap">{r.comparisonGroup ? `${r.comparisonGroup} (${r.comparisonSize ?? 0})` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 지표 입력 폼(관리자) ──────────────────────────────────────────────────
function MetricForm({
  brandId, pending, startTransition, onDone, ruleset,
}: {
  brandId: string;
  pending: boolean;
  startTransition: TransitionStartFunction;
  onDone: () => void;
  ruleset: Ruleset | null;
}) {
  const codes = ruleset ? [...ruleset.base.map((c) => c.code), ruleset.bonus.code] : ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];
  const [code, setCode] = useState(codes[0]);
  const [val, setVal] = useState("");
  const [na, setNa] = useState("");

  function submit() {
    const hasVal = val.trim() !== "";
    const value = hasVal ? Number(val) : null;
    if (hasVal && Number.isNaN(value)) { toast.error("값은 숫자여야 합니다."); return; }
    startTransition(async () => {
      const res = await saveMetric({ brand_id: brandId, metric_code: code, value, na_reason: hasVal ? undefined : na });
      if (res.ok) { toast.success(`${code} 저장`); setVal(""); setNa(""); onDone(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
      <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">지표
        <select value={code} onChange={(e) => setCode(e.target.value)} className="border border-slate-300 px-2 py-1 text-[12px] font-bold outline-none">
          {codes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">원값(숫자)
        <input value={val} onChange={(e) => { setVal(e.target.value); if (e.target.value) setNa(""); }} placeholder="예: 12" className={`${inputCompact} w-24`} />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">또는 N/A 사유
        <select value={na} onChange={(e) => { setNa(e.target.value); if (e.target.value) setVal(""); }} disabled={val.trim() !== ""} className="border border-slate-300 px-2 py-1 text-[12px] outline-none disabled:opacity-40">
          <option value="">—</option>
          {NA_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <button onClick={submit} disabled={pending} className={TOKENS.btn.primary}>저장</button>
    </div>
  );
}

// ── 브랜드 등록 폼(관리자) ─────────────────────────────────────────────────
function RegisterForm({
  pending, startTransition, onDone,
}: {
  pending: boolean;
  startTransition: TransitionStartFunction;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [minor, setMinor] = useState("");
  const [online, setOnline] = useState(true);

  function submit() {
    if (!name.trim() || !major.trim() || !minor.trim()) { toast.error("브랜드명·대분류·중분류를 입력하세요."); return; }
    startTransition(async () => {
      const res = await registerBrand({ name, category_major: major, category_minor: minor, online_applicable: online });
      if (res.ok) { toast.success(`${name.trim()} 등록`); setName(""); setMajor(""); setMinor(""); setOnline(true); onDone(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 border-[2px] border-[#0a0a0a] bg-white p-3 shadow-[3px_3px_0_0_#0a0a0a]">
      <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">브랜드명
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="브랜드명" className={`${inputCompact} w-40`} />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">대분류
        <input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="예: 홈·리빙" className={`${inputCompact} w-32`} />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">중분류
        <input value={minor} onChange={(e) => setMinor(e.target.value)} placeholder="예: 침구·매트리스" className={`${inputCompact} w-36`} />
      </label>
      <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
        <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> 온라인 채널 적용(C7)
      </label>
      <button onClick={submit} disabled={pending} className={TOKENS.btn.primary}>등록</button>
    </div>
  );
}

// ── 기준(ruleset) 편집기(관리자) — C1~C8 배점·경계값·등급컷 직접 수정 ──────────
const MODE_LABEL: Record<CriterionMode, string> = { abs: "절대", pct: "백분위", sel: "선택" };

function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <td className="px-1 py-1 text-center">
      <input type="number" value={value}
        onChange={(e) => { const n = parseFloat(e.target.value); onChange(Number.isFinite(n) ? n : 0); }}
        className="w-16 border border-slate-300 px-1 py-0.5 text-[11px] text-right outline-none" />
    </td>
  );
}

function RulesetEditor({
  ruleset, pending, startTransition, onDone,
}: {
  ruleset: Ruleset;
  pending: boolean;
  startTransition: TransitionStartFunction;
  onDone: () => void;
}) {
  const [rs, setRs] = useState<Ruleset>(() => JSON.parse(JSON.stringify(ruleset)) as Ruleset);
  const [note, setNote] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<null | { sum: number; totalBrands: number; changedCount: number; gradeCounts: Record<string, number> }>(null);

  const sum = rs.base.reduce((t, c) => t + (Number(c.weight) || 0), 0);
  const sumOk = sum === 100;

  function setBase(i: number, field: keyof Criterion, value: number | string) {
    setRs((prev) => {
      const base = prev.base.map((c, idx) => (idx === i ? { ...c, [field]: value } : c));
      return { ...prev, base };
    });
    setPreview(null);
  }
  function setBonus(field: keyof Criterion, value: number | string) {
    setRs((prev) => ({ ...prev, bonus: { ...prev.bonus, [field]: value } }));
    setPreview(null);
  }
  function setCut(k: keyof Ruleset["cuts"], value: number) {
    setRs((prev) => ({ ...prev, cuts: { ...prev.cuts, [k]: value } }));
    setPreview(null);
  }

  async function doPreview() {
    setPreviewing(true);
    try {
      const res = await fetch("/api/bcd/score/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleset: rs }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? data.error ?? "미리보기 실패"); return; }
      setPreview({ sum: data.sum, totalBrands: data.totalBrands, changedCount: data.changedCount, gradeCounts: data.gradeCounts ?? {} });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setPreviewing(false); }
  }

  function save() {
    if (!sumOk) { toast.error(`기본 배점 합이 ${sum} — 100이어야 저장됩니다.`); return; }
    if (!window.confirm(`기준을 새 버전으로 저장하고 활성화합니다. 전 브랜드 재채점됩니다. 진행할까요?`)) return;
    startTransition(async () => {
      const res = await saveRuleset(rs, note);
      if (res.ok) { toast.success(`저장됨 · ${res.version} 활성`); onDone(); }
      else toast.error(res.error);
    });
  }

  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  return (
    <div className="mt-2 space-y-3 border-[2px] border-[#0a0a0a] bg-white p-3 shadow-[3px_3px_0_0_#0a0a0a]">
      <p className="text-[11px] text-slate-500">
        배점(만점)·중(중간점수)·상기준(t1)·중기준(t2)·판정방식을 수정합니다. <b>기본 배점 합은 100</b>이어야 저장됩니다.
        절대=값 자체가 기준 이상, 백분위=비교군 내 상위%, 선택=원값이 곧 점수.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[11px]">
          <thead className="bg-[#F1ECDB] text-[#0a0a0a]">
            <tr>
              <th className="px-2 py-1 text-left">지표</th>
              <th className="px-1 py-1">방식</th>
              <th className="px-1 py-1">배점</th>
              <th className="px-1 py-1">중</th>
              <th className="px-1 py-1">상기준(t1)</th>
              <th className="px-1 py-1">중기준(t2)</th>
            </tr>
          </thead>
          <tbody>
            {rs.base.map((c, i) => (
              <tr key={c.code} className="border-t border-slate-100">
                <td className="px-2 py-1 font-bold whitespace-nowrap">{c.code} {c.name}</td>
                <td className="px-1 py-1 text-center">
                  <select value={c.mode} onChange={(e) => setBase(i, "mode", e.target.value)}
                    className="border border-slate-300 px-1 py-0.5 text-[11px] outline-none">
                    {(["abs", "pct", "sel"] as CriterionMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                  </select>
                </td>
                <NumCell value={c.weight} onChange={(n) => setBase(i, "weight", n)} />
                <NumCell value={c.mid} onChange={(n) => setBase(i, "mid", n)} />
                <NumCell value={c.t1} onChange={(n) => setBase(i, "t1", n)} />
                <NumCell value={c.t2} onChange={(n) => setBase(i, "t2", n)} />
              </tr>
            ))}
            <tr className="border-t-2 border-[#0a0a0a] bg-slate-50">
              <td className="px-2 py-1 font-bold whitespace-nowrap">{rs.bonus.code} {rs.bonus.name} (가점)</td>
              <td className="px-1 py-1 text-center text-slate-400">{MODE_LABEL[rs.bonus.mode]}</td>
              <NumCell value={rs.bonus.weight} onChange={(n) => setBonus("weight", n)} />
              <NumCell value={rs.bonus.mid} onChange={(n) => setBonus("mid", n)} />
              <NumCell value={rs.bonus.t1} onChange={(n) => setBonus("t1", n)} />
              <NumCell value={rs.bonus.t2} onChange={(n) => setBonus("t2", n)} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span className={`font-extrabold ${sumOk ? "text-emerald-700" : "text-rose-600"}`}>기본 배점 합 {sum} {sumOk ? "✓" : "✗ (100 필요)"}</span>
        <span className="text-slate-500">등급컷:</span>
        {(["A", "Bp", "B", "C"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1 text-[11px] font-bold">
            {k === "Bp" ? "B+" : k}
            <input type="number" value={rs.cuts[k]} onChange={(e) => setCut(k, num(parseFloat(e.target.value)))}
              className="w-14 border border-slate-300 px-1 py-0.5 text-right outline-none" />
          </label>
        ))}
        <label className="flex items-center gap-1 text-[11px] font-bold">N/A 한도
          <input type="number" value={rs.na_policy.max_na_points}
            onChange={(e) => { const v = num(parseFloat(e.target.value)); setRs((p) => ({ ...p, na_policy: { ...p.na_policy, max_na_points: v } })); setPreview(null); }}
            className="w-14 border border-slate-300 px-1 py-0.5 text-right outline-none" />
        </label>
        <label className="flex items-center gap-1 text-[11px] font-bold">백분위 최소표본
          <input type="number" value={rs.pct_min_sample}
            onChange={(e) => { const v = num(parseFloat(e.target.value)); setRs((p) => ({ ...p, pct_min_sample: v })); setPreview(null); }}
            className="w-14 border border-slate-300 px-1 py-0.5 text-right outline-none" />
        </label>
      </div>

      {preview && (
        <div className="border-[2px] border-[#0a0a0a] bg-yellow-50 p-2 text-[11px]">
          <b>미리보기</b> · 대상 {preview.totalBrands}개 · 등급 변동 <b>{preview.changedCount}</b>건 · 분포:{" "}
          {GRADE_ORDER.filter((g) => preview.gradeCounts[g]).map((g) => `${g} ${preview.gradeCounts[g]}`).join(" · ") || "—"}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="변경 사유(선택)" className={`${inputCompact} w-56`} />
        <button onClick={doPreview} disabled={previewing} className={TOKENS.btn.secondary}>{previewing ? "계산 중…" : "미리보기(재채점 전)"}</button>
        <button onClick={save} disabled={pending || !sumOk} className={TOKENS.btn.primary}>새 버전으로 저장·활성화</button>
      </div>
    </div>
  );
}

// ── 벤치마크·핫플 목록 관리(관리자) ────────────────────────────────────────
function ListManager({
  lists, pending, startTransition, onDone,
}: {
  lists: ListRow[];
  pending: boolean;
  startTransition: TransitionStartFunction;
  onDone: () => void;
}) {
  const [type, setType] = useState<"benchmark" | "hotspot">("benchmark");
  const [name, setName] = useState("");
  const [match, setMatch] = useState("");
  const [fullSurvey, setFullSurvey] = useState(true);
  const rows = lists.filter((l) => l.list_type === type);

  function add() {
    if (!name.trim()) { toast.error("이름을 입력하세요."); return; }
    startTransition(async () => {
      const res = await addList({ list_type: type, name, match_strings: match, is_full_survey: fullSurvey });
      if (res.ok) { toast.success(`${name.trim()} 추가`); setName(""); setMatch(""); onDone(); }
      else toast.error(res.error);
    });
  }
  function remove(id: string, nm: string) {
    if (!window.confirm(`'${nm}' 삭제할까요?`)) return;
    startTransition(async () => {
      const res = await deleteList(id);
      if (res.ok) { toast.success("삭제됨"); onDone(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="mt-2 space-y-3 border-[2px] border-[#0a0a0a] bg-white p-3 shadow-[3px_3px_0_0_#0a0a0a]">
      <div className="flex gap-1.5">
        <button onClick={() => setType("benchmark")} className={pillBtn(type === "benchmark")}>벤치마크 유통 (C1)</button>
        <button onClick={() => setType("hotspot")} className={pillBtn(type === "hotspot")}>핫플 상권 (C2)</button>
      </div>
      <p className="text-[11px] text-slate-500">
        {type === "benchmark"
          ? "C1 분모 = 전수조사(is_full_survey) 벤치마크 유통 수. 매칭어는 매장 주소/상호에 등장하는 표기 변형(쉼표 구분)."
          : "C2 = 매장 주소가 핫플 상권 매칭어와 겹치는 고유 매장 수. 매칭어는 동/지역 키워드(쉼표 구분)."}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">이름
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "benchmark" ? "예: 신세계 강남" : "예: 강남역·역삼"} className={`${inputCompact} w-40`} />
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] font-bold text-slate-500">매칭어(쉼표)
          <input value={match} onChange={(e) => setMatch(e.target.value)} placeholder={type === "benchmark" ? "신세계강남, 강남점" : "역삼동, 강남대로"} className={`${inputCompact} w-56`} />
        </label>
        {type === "benchmark" && (
          <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
            <input type="checkbox" checked={fullSurvey} onChange={(e) => setFullSurvey(e.target.checked)} /> 전수조사(C1 분모 포함)
          </label>
        )}
        <button onClick={add} disabled={pending} className={TOKENS.btn.primary}>추가</button>
      </div>
      <div className="max-h-64 overflow-y-auto border border-slate-200">
        <table className="w-full text-[11px]">
          <thead className="bg-[#F1ECDB] text-[#0a0a0a]">
            <tr>
              <th className="px-2 py-1 text-left">이름</th>
              <th className="px-2 py-1 text-left">매칭어</th>
              {type === "benchmark" && <th className="px-2 py-1 text-center">전수</th>}
              <th className="px-2 py-1 text-center">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-bold whitespace-nowrap">{l.name}</td>
                <td className="px-2 py-1 text-slate-500">{(l.match_strings ?? []).join(", ")}</td>
                {type === "benchmark" && <td className="px-2 py-1 text-center">{l.is_full_survey ? "✓" : "—"}</td>}
                <td className="px-2 py-1 text-center">
                  <button onClick={() => remove(l.id, l.name)} disabled={pending} className="text-rose-600 font-bold hover:underline disabled:opacity-50">삭제</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={type === "benchmark" ? 4 : 3} className="px-2 py-4 text-center text-slate-400">
                {type === "benchmark" ? "벤치마크 유통이 없습니다. bcd_seed.sql 적용 또는 위에서 추가하세요." : "핫플 상권이 없습니다. bcd_hotspot_seed.sql 적용 또는 위에서 추가하세요."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`border-[2px] border-[#0a0a0a] p-3 shadow-[3px_3px_0_0_#0a0a0a] ${highlight ? "bg-yellow-100" : "bg-white"}`}>
      <div className="text-[11px] font-bold text-slate-500 truncate">{label}</div>
      <div className="mt-1 font-mono text-[20px] sm:text-[24px] font-extrabold leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[10px] text-slate-400 truncate">{sub}</div>}
    </div>
  );
}
