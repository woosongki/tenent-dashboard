"use client";

import { useState } from "react";
import {
  rankStores,
  type BrandInput,
  type Stay,
  type OperationType,
  type AvoidStrength,
  type FitScore,
} from "@/lib/brand-fit/score";
import type { AgeBand, Gender, FamilyRatio, PriceBand, SpaceSize } from "@/data/eland-meta";

const AGES: AgeBand[]      = ["10대", "20대", "30대", "40대", "50대", "60대+"];
const GENDERS: Gender[]    = ["여성 중심", "남성 중심", "균형"];
const FAMILIES: FamilyRatio[] = ["가족 중심", "개인 중심", "둘 다"];
const STAYS: Stay[]        = ["목적형", "체험형", "체류형"];
const CATEGORIES = ["리빙", "잡화", "키즈", "뷰티", "F&B", "헬스·웰니스", "기타"];
const PRICES: PriceBand[]  = ["초저가", "중저가", "중가", "중고가", "고가"];
const SPACES: SpaceSize[]  = ["~30평", "30~50평", "50~100평", "100평+"];
const OPS: OperationType[] = ["상시매장", "팝업(단기)", "시즌형"];
const AVOIDS: AvoidStrength[] = ["강함", "보통", "약함"];

export default function BrandFitClient() {
  // 확보가능 (8개)
  const [primaryAge, setPrimaryAge] = useState<AgeBand[]>([]);
  const [primaryGender, setPrimaryGender] = useState<Gender | null>(null);
  const [familyRatio, setFamilyRatio] = useState<FamilyRatio | null>(null);
  const [stayType, setStayType] = useState<Stay | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [priceBand, setPriceBand] = useState<PriceBand | null>(null);
  const [requiredSpace, setRequiredSpace] = useState<SpaceSize | null>(null);
  const [operationType, setOperationType] = useState<OperationType | null>(null);
  // 반드시 (2개)
  const [anchorTag, setAnchorTag] = useState("");
  const [preferredAnchors, setPreferredAnchors] = useState<string[]>([]);
  const [avoidStrength, setAvoidStrength] = useState<AvoidStrength | null>(null);

  // 결과
  const [results, setResults] = useState<FitScore[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const canAnalyze = preferredAnchors.length > 0 && avoidStrength !== null;

  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function addAnchor() {
    const t = anchorTag.trim();
    if (!t || preferredAnchors.includes(t)) return;
    setPreferredAnchors([...preferredAnchors, t]);
    setAnchorTag("");
  }

  function analyze() {
    const input: BrandInput = {
      primary_age: primaryAge,
      primary_gender: primaryGender,
      family_ratio: familyRatio,
      stay_type: stayType,
      category: category,
      price_band: priceBand,
      required_space: requiredSpace,
      operation_type: operationType,
      preferred_anchors: preferredAnchors,
      avoid_strength: avoidStrength!,
    };
    setResults(rankStores(input, 3));
    setSubmitted(true);
    // 결과 스크롤
    setTimeout(() => {
      document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  function reset() {
    setPrimaryAge([]); setPrimaryGender(null); setFamilyRatio(null);
    setStayType(null); setCategory(null); setPriceBand(null);
    setRequiredSpace(null); setOperationType(null);
    setPreferredAnchors([]); setAvoidStrength(null); setAnchorTag("");
    setResults([]); setSubmitted(false);
  }

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <div className="mb-6">
        <h1 className="font-display text-[28px] leading-none text-[#0a0a0a]">브랜드 적합도 진단</h1>
        <p className="mt-2 text-[13px] text-slate-600">
          체크리스트로 브랜드 특성을 입력하면 41개 이랜드 점포 중 적합도 TOP3를 알려드립니다.
        </p>
      </div>

      {/* ── 필수 입력 ── */}
      <Section title="🔴 반드시 입력" desc="단이님의 전략적 판단이 필요한 항목">
        <Field label="인접 선호 앵커" required>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {preferredAnchors.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 border-[2px] border-[#0a0a0a] bg-yellow-200 px-2 py-1 text-[12px] font-bold shadow-[2px_2px_0_0_#0a0a0a]">
                {t}
                <button onClick={() => setPreferredAnchors(preferredAnchors.filter((x) => x !== t))} className="ml-1 text-slate-600 hover:text-red-600">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={anchorTag}
              onChange={(e) => setAnchorTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAnchor(); } }}
              placeholder="예: 다이소, 애슐리, F&B, 올리브영"
              className="flex-1 border-[2px] border-[#0a0a0a] px-3 py-2 text-[13px] focus:outline-none focus:bg-yellow-50"
            />
            <button onClick={addAnchor} className="border-[2px] border-[#0a0a0a] bg-white px-4 py-2 text-[12px] font-bold hover:bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]">
              추가
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">💡 이 브랜드가 시너지 낼 만한 앵커를 자유롭게 입력 (Enter로 추가)</p>
        </Field>

        <Field label="경쟁/유사 브랜드 회피 강도" required>
          <ChipGroup options={AVOIDS} value={avoidStrength} onChange={setAvoidStrength} />
        </Field>
      </Section>

      {/* ── 확보가능 입력 ── */}
      <Section title="🟢 브랜드 정보" desc="알고 계시면 입력 — 비워두면 기본값으로 점수 산출">
        <Field label="주력 타겟 연령 (다중 선택)">
          <div className="flex flex-wrap gap-1.5">
            {AGES.map((a) => (
              <button
                key={a}
                onClick={() => setPrimaryAge(toggleArr(primaryAge, a))}
                className={`border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] font-bold transition ${
                  primaryAge.includes(a) ? "bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-yellow-50"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </Field>

        <Field label="주력 성별">
          <ChipGroup options={GENDERS} value={primaryGender} onChange={setPrimaryGender} allowNull />
        </Field>

        <Field label="가족 단위 vs 개인">
          <ChipGroup options={FAMILIES} value={familyRatio} onChange={setFamilyRatio} allowNull />
        </Field>

        <Field label="체류시간 성격">
          <ChipGroup options={STAYS} value={stayType} onChange={setStayType} allowNull />
        </Field>

        <Field label="카테고리">
          <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} allowNull />
        </Field>

        <Field label="가격대">
          <ChipGroup options={PRICES} value={priceBand} onChange={setPriceBand} allowNull />
        </Field>

        <Field label="필요 평형">
          <ChipGroup options={SPACES} value={requiredSpace} onChange={setRequiredSpace} allowNull />
        </Field>

        <Field label="운영 형태">
          <ChipGroup options={OPS} value={operationType} onChange={setOperationType} allowNull />
        </Field>
      </Section>

      {/* ── 액션 ── */}
      <div className="sticky bottom-4 mt-6 flex gap-3 z-10">
        <button
          onClick={analyze}
          disabled={!canAnalyze}
          className={`flex-1 border-[3px] border-[#0a0a0a] py-3 font-display text-[18px] transition ${
            canAnalyze
              ? "bg-yellow-300 text-[#0a0a0a] shadow-[4px_4px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#0a0a0a]"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {canAnalyze ? "🎯 적합도 분석" : "필수 항목 입력 필요"}
        </button>
        <button
          onClick={reset}
          className="border-[3px] border-[#0a0a0a] bg-white px-6 font-bold hover:bg-slate-100"
        >
          초기화
        </button>
      </div>

      {/* ── 결과 ── */}
      {submitted && (
        <div id="result-section" className="mt-10 border-t-[3px] border-[#0a0a0a] pt-6">
          <h2 className="font-display text-[22px] mb-1">TOP 3 추천 지점</h2>
          <p className="text-[12px] text-slate-500 mb-4">
            ⚠️ 정성 데이터가 비어있는 지점이 많으면 결과 신뢰도가 낮습니다. <code className="text-[11px]">src/data/eland-meta.ts</code> 에 데이터를 채워주세요.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {results.map((r, i) => (
              <ResultCard key={r.store.id} rank={i + 1} fit={r} />
            ))}
          </div>

          <div className="mt-6 border-[2px] border-[#0a0a0a] bg-white">
            <table className="w-full text-[12px]">
              <thead className="bg-[#0a0a0a] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">지점</th>
                  <th className="px-2 py-2 text-right">상권 35%</th>
                  <th className="px-2 py-2 text-right">앵커 30%</th>
                  <th className="px-2 py-2 text-right">성격 20%</th>
                  <th className="px-2 py-2 text-right">시너지 15%</th>
                  <th className="px-3 py-2 text-right">종합</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.store.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-bold">
                      {r.store.brand} {r.store.name}
                      {!r.hasData && <span className="ml-2 text-[10px] text-amber-600">⚠ 데이터 없음</span>}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{Math.round(r.axes.trade_area)}</td>
                    <td className="px-2 py-2 text-right font-mono">{Math.round(r.axes.anchors)}</td>
                    <td className="px-2 py-2 text-right font-mono">{Math.round(r.axes.character)}</td>
                    <td className="px-2 py-2 text-right font-mono">{Math.round(r.axes.synergy)}</td>
                    <td className="px-3 py-2 text-right font-mono font-extrabold text-[14px]">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 헬퍼 컴포넌트 ──

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 border-[2px] border-[#0a0a0a] bg-white p-4 shadow-[3px_3px_0_0_#0a0a0a]">
      <div className="mb-3 border-b-[2px] border-[#0a0a0a] pb-2">
        <div className="font-display text-[16px]">{title}</div>
        {desc && <div className="mt-0.5 text-[11px] text-slate-500">{desc}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-[12px] font-bold text-[#0a0a0a]">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChipGroup<T extends string>({
  options, value, onChange, allowNull = false,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowNull?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(allowNull && value === o ? null : o)}
          className={`border-[2px] border-[#0a0a0a] px-3 py-1.5 text-[12px] font-bold transition ${
            value === o ? "bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]" : "bg-white hover:bg-yellow-50"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function ResultCard({ rank, fit }: { rank: number; fit: FitScore }) {
  const rankColors = ["#ef476f", "#ffb547", "#06d6a0"];
  const color = rankColors[rank - 1] ?? "#5a6378";
  return (
    <div
      className="border-[3px] border-[#0a0a0a] bg-white p-4"
      style={{ boxShadow: `5px 5px 0 0 #0a0a0a`, borderTopColor: color, borderTopWidth: 8 }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-display text-[14px] text-slate-500">#{rank}</span>
        {!fit.hasData && <span className="text-[9px] font-bold text-amber-600">⚠ 데이터 보완 필요</span>}
      </div>
      <div className="font-bold text-[14px] text-[#0a0a0a]">{fit.store.brand}</div>
      <div className="font-display text-[18px] text-[#0a0a0a] mb-2">{fit.store.name}</div>
      <div className="font-mono text-[36px] font-extrabold text-[#0a0a0a] leading-none">{fit.total}</div>
      <div className="text-[10px] text-slate-500 mb-3">/ 100점</div>

      <div className="space-y-1.5">
        {[
          { label: "상권", v: fit.axes.trade_area },
          { label: "앵커", v: fit.axes.anchors },
          { label: "성격", v: fit.axes.character },
          { label: "시너지", v: fit.axes.synergy },
        ].map((a) => (
          <div key={a.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-10 shrink-0 text-slate-500">{a.label}</span>
            <div className="flex-1 h-2 bg-slate-100 border border-slate-300">
              <div className="h-full" style={{ width: `${Math.round(a.v)}%`, background: color }} />
            </div>
            <span className="w-8 text-right font-mono font-bold">{Math.round(a.v)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
        📍 {fit.store.addr}
      </div>
    </div>
  );
}
