"use client";

import { useState, useTransition } from "react";
import {
  WEIGHTS,
  type BrandInput,
  type Stay,
  type OperationType,
  type AvoidStrength,
  type FitScore,
} from "@/lib/brand-fit/types";
import { analyzeBrandFit } from "../_actions";
import { inputBase } from "@/lib/tokens";
import type { AgeBand, Gender, FamilyRatio, PriceBand, SpaceSize } from "@/data/eland-meta";

const AGES: AgeBand[]      = ["10대", "20대", "30대", "40대", "50대", "60대+"];
const GENDERS: Gender[]    = ["여성 중심", "남성 중심", "균형"];
const FAMILIES: FamilyRatio[] = ["가족 중심", "개인 중심", "둘 다"];
const STAYS: Stay[]        = ["목적형", "체험형", "체류형"];
const CATEGORIES = ["패션", "리빙", "잡화", "키즈", "뷰티", "F&B", "헬스·웰니스", "기타"];
const PRICES: PriceBand[]  = ["초저가", "중저가", "중가", "중고가", "고가"];
const SPACES: SpaceSize[]  = ["~30평", "30~50평", "50~100평", "100평+"];
const OPS: OperationType[] = ["상시매장", "팝업(단기)", "시즌형"];
const AVOIDS: AvoidStrength[] = ["강함", "보통", "약함"];

export default function BrandFitClient() {
  // 브랜드명 (단독 입력 가능 — 비어있는 옵션은 기본값으로)
  const [brandName, setBrandName] = useState("");
  // 확보가능 (8개)
  const [primaryAge, setPrimaryAge] = useState<AgeBand[]>([]);
  const [primaryGender, setPrimaryGender] = useState<Gender | null>(null);
  const [familyRatio, setFamilyRatio] = useState<FamilyRatio | null>(null);
  const [stayType, setStayType] = useState<Stay | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [priceBand, setPriceBand] = useState<PriceBand | null>(null);
  const [requiredSpace, setRequiredSpace] = useState<SpaceSize | null>(null);
  const [operationType, setOperationType] = useState<OperationType | null>(null);
  // 선택 (앵커·회피강도)
  const [anchorTag, setAnchorTag] = useState("");
  const [preferredAnchors, setPreferredAnchors] = useState<string[]>([]);
  const [avoidStrength, setAvoidStrength] = useState<AvoidStrength | null>(null);

  // 결과
  const [results, setResults] = useState<FitScore[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submittedBrand, setSubmittedBrand] = useState("");
  // 점수 로직 패널
  const [showLogic, setShowLogic] = useState(false);
  const [pending, startTransition] = useTransition();

  // 브랜드명만 있으면 분석 가능 (다른 옵션은 모두 선택적)
  const canAnalyze = brandName.trim().length > 0;

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
      avoid_strength: avoidStrength ?? "보통", // 미입력 시 기본값
    };
    startTransition(async () => {
      const scored = await analyzeBrandFit(input, 3);
      setResults(scored);
      setSubmitted(true);
      setSubmittedBrand(brandName.trim());
      setTimeout(() => {
        document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    });
  }

  function reset() {
    setBrandName("");
    setPrimaryAge([]); setPrimaryGender(null); setFamilyRatio(null);
    setStayType(null); setCategory(null); setPriceBand(null);
    setRequiredSpace(null); setOperationType(null);
    setPreferredAnchors([]); setAvoidStrength(null); setAnchorTag("");
    setResults([]); setSubmitted(false); setSubmittedBrand("");
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-[1100px] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] leading-none text-[#0a0a0a]">브랜드 적합도 진단</h1>
          <p className="mt-2 text-[13px] text-slate-600">
            브랜드명만 입력해도 기본값으로 분석 가능. 추가 옵션은 정확도를 높이는 용도.
          </p>
        </div>
        <button
          onClick={() => setShowLogic((v) => !v)}
          className={`shrink-0 border-[2px] border-[#0a0a0a] px-4 py-2 text-[12px] font-bold transition shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0a0a0a] ${
            showLogic ? "bg-[#0a0a0a] text-white" : "bg-cyan-300 text-[#0a0a0a]"
          }`}
        >
          {showLogic ? "✕ 점수 로직 닫기" : "🧮 점수 산출 방식 보기"}
        </button>
      </div>

      {showLogic && <ScoringLogicPanel />}

      {/* ── 브랜드명 단독 입력 (필수, 최상단) ── */}
      <div className="mb-6 border-[3px] border-[#0a0a0a] bg-yellow-100 p-5 shadow-[5px_5px_0_0_#0a0a0a]">
        <label className="block mb-2 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]">
          적합도 진단 브랜드명
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAnalyze) {
                e.preventDefault();
                analyze();
              }
            }}
            placeholder="예: 다이소, 무신사, 올리브영, 스타벅스..."
            className="flex-1 border-[2px] border-[#0a0a0a] bg-white px-4 py-3 font-mono text-[18px] font-bold placeholder-slate-400 focus:outline-none focus:bg-yellow-50"
            autoFocus
          />
          <button
            onClick={analyze}
            disabled={!canAnalyze || pending}
            className={`shrink-0 border-[2px] border-[#0a0a0a] px-8 font-display text-[16px] transition ${
              canAnalyze && !pending
                ? "bg-[#0a0a0a] text-white shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {pending ? "분석 중…" : "분석"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#0a0a0a]/70">
          💡 브랜드명만으로 즉시 분석 (Enter). 아래 옵션은 정확도 향상용 — 비워두면 기본값.
        </p>
      </div>

      {/* ── 선택 입력 (앵커·회피) ── */}
      <Section title="🎯 정확도 향상 (선택)" desc="입력하면 점수 산출 정확도가 올라갑니다">
        <Field label="인접 선호 앵커">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {preferredAnchors.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 border-[2px] border-[#0a0a0a] bg-yellow-200 px-2 py-1 text-[12px] font-bold shadow-[2px_2px_0_0_#0a0a0a]">
                {t}
                <button onClick={() => setPreferredAnchors(preferredAnchors.filter((x) => x !== t))} aria-label={`${t} 제거`} className="ml-1 text-slate-600 hover:text-red-600">✕</button>
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
              className={`flex-1 ${inputBase}`}
            />
            <button onClick={addAnchor} className="border-[2px] border-[#0a0a0a] bg-white px-4 py-2 text-[12px] font-bold hover:bg-yellow-300 shadow-[2px_2px_0_0_#0a0a0a]">
              추가
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">💡 이 브랜드가 시너지 낼 만한 앵커 (Enter로 추가)</p>
        </Field>

        <Field label="경쟁/유사 브랜드 회피 강도">
          <ChipGroup options={AVOIDS} value={avoidStrength} onChange={setAvoidStrength} allowNull />
          <p className="mt-1.5 text-[11px] text-slate-500">💡 미선택 시 &quot;보통&quot; 으로 처리</p>
        </Field>
      </Section>

      {/* ── 확보가능 입력 ── */}
      <Section title="🟢 브랜드 정보 (선택)" desc="알고 계시면 입력 — 비워두면 점수 산출에서 제외">
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

      {/* ── 추가 분석/초기화 (하단) ── */}
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
          {canAnalyze ? "🎯 옵션 반영해서 다시 분석" : "브랜드명 입력 필요"}
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
          <div className="mb-4 flex items-baseline gap-3 flex-wrap">
            <h2 className="font-display text-[22px]">{submittedBrand}</h2>
            <span className="text-[13px] text-slate-500">TOP 3 추천 지점</span>
          </div>
          <p className="text-[12px] text-slate-500 mb-4">
            ⚠️ 정성 데이터가 비어있는 지점이 많으면 결과 신뢰도가 낮습니다. <code className="text-[11px]">src/data/eland-meta.ts</code> 에 데이터를 채워주세요.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {results.map((r, i) => (
              <ResultCard key={r.store.id} rank={i + 1} fit={r} />
            ))}
          </div>

          <div className="mt-6 border-[2px] border-[#0a0a0a] bg-white overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12px]">
              <thead className="bg-[#0a0a0a] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">지점</th>
                  <th className="px-2 py-2 text-right">상권 {Math.round(WEIGHTS.trade_area * 100)}%</th>
                  <th className="px-2 py-2 text-right">앵커 {Math.round(WEIGHTS.anchors * 100)}%</th>
                  <th className="px-2 py-2 text-right">성격 {Math.round(WEIGHTS.character * 100)}%</th>
                  <th className="px-2 py-2 text-right">시너지 {Math.round(WEIGHTS.synergy * 100)}%</th>
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
    </div>
  );
}

// ── 점수 산출 방식 패널 ──
// src/lib/brand-fit/score.ts 의 실제 로직을 한 화면에 정리 (변경 시 동기화 필요)

const AXES = [
  {
    key: "trade_area",
    title: "① 상권 / 고객층",
    weight: Math.round(WEIGHTS.trade_area * 100),
    color: "#ef476f",
    desc: "상권 규모·유동인구 + 점포 구매고객의 연령·성별·가족 구성과 브랜드 타겟의 일치도",
    rows: [
      { name: "상권 규모·유동인구", w: "1.2", detail: "권역(수도권 55/광역시 42/지방 32) + 반경 500m 실측 상가밀도 정규화(0~45). 브랜드 입력과 무관하게 항상 반영. 큰 점포 쏠림 방지를 위해 가중 억제(1.2)" },
      { name: "상권 성격 적합", w: "1.0", detail: "카테고리 입력 시. 음식형(F&B)은 주변 음식업 비중, 소매형(패션·잡화 등)은 소매업 비중이 높은 상권에 가점 (반경 500m 업종 믹스 정규화)" },
      { name: "체류 성격", w: "1.0", detail: "체류시간 성격 입력 시. 체류형=음식+여가 비중, 체험형=여가 비중, 목적형=소매 비중이 높은 상권에 가점" },
      { name: "연령 매칭", w: "2.0", detail: "점포 1순위 연령 = 1.0 / 2순위 = 0.5 가중. 선호 연령이 점포 주력 연령에 포함될수록 100점에 근접" },
      { name: "성별", w: "0.5", detail: "동일 95 / 한쪽이 '균형' 65 / 반대 25. 전 점포가 '여성 중심'이라 변별력이 낮아 가중치 최소화" },
      { name: "가족 비율", w: "1.5", detail: "동일 100 / 한쪽이 '둘 다' 75 / 반대 35" },
    ],
  },
  {
    key: "anchors",
    title: "② 인접 앵커 · 동선",
    weight: Math.round(WEIGHTS.anchors * 100),
    color: "#ffb547",
    desc: "입력한 선호 앵커가 점포 TOP10 매출 브랜드에 들어있는지",
    rows: [
      { name: "앵커별 매칭", w: "—", detail: "정확 일치 100 / 점포 앵커가 입력어를 포함 75 / 입력어가 앵커를 포함 60 / 불일치 0" },
      { name: "개수 보너스", w: "—", detail: "3개 이상 매칭 +15 / 2개 +8 (최대 100)" },
      { name: "예외", w: "—", detail: "선호 앵커 미입력 → 이 축 제외 · 점포 앵커 데이터 없음 → 10점" },
    ],
  },
  {
    key: "character",
    title: "③ 브랜드 성격",
    weight: Math.round(WEIGHTS.character * 100),
    color: "#06d6a0",
    desc: "카테고리·가격대가 점포 테넌트 구성과 맞는지",
    rows: [
      { name: "카테고리", w: "2.0", detail: "점포의 해당 카테고리 매출 비중 합 → 30%+ 95 / 20%+ 80 / 10%+ 60 / 5%+ 40 / 그 외 25 / 매칭 없음 15" },
      { name: "가격대", w: "1.0", detail: "점포 실제 객단가(store-sales)와 입력 가격대 대표 객단가의 상대 거리로 채점 → 41점 모두 다른 값이라 촘촘한 차등 (실데이터 없으면 5단계 밴드 거리로 폴백)" },
      { name: "필요 평형", w: "1.0", detail: "공실(입점가능 공간) 데이터는 변동성이 커 정적 미입력 → 사실상 비활성" },
    ],
  },
  {
    key: "synergy",
    title: "④ 시너지",
    weight: Math.round(WEIGHTS.synergy * 100),
    color: "#7c3aed",
    desc: "운영 형태 적합성 + 카니발(잠식) 회피 + 매장 규모",
    rows: [
      { name: "팝업 친화", w: "1.0", detail: "상시매장 90 / 팝업친화 점포 95 / 비친화 30" },
      { name: "카니발 회피", w: "1.5", detail: "동일 카테고리 비중이 클수록 감점, 회피 강도(강함/보통/약함)에 따라 차등" },
      { name: "매장 규모", w: "1.0", detail: "실제 전용면적(평)을 41점 분포로 0~1 정규화 → 40~95점. 면적 데이터 없으면 브랜드 수로 폴백" },
    ],
  },
];

const DATA_SOURCES = [
  { label: "상권 규모", src: "trade-area.json (권역 + 소상공인 상가업소 반경 500m 밀도, data.go.kr)" },
  { label: "상권 성격", src: "trade-area.json (반경 500m 음식·소매·여가 업종 비중)" },
  { label: "연령", src: "store-demographics.json (구매고객 연령대)" },
  { label: "성별", src: "전사 평균 여성 78% → 전 점포 '여성 중심' 가정" },
  { label: "가격대", src: "store-sales.json (점포 실제 객단가 거리 매칭)" },
  { label: "카테고리", src: "store-categories.json (10개 카테고리 매출 비중)" },
  { label: "앵커", src: "store-brands.json (점포별 매출 TOP10)" },
  { label: "매장 규모", src: "store-areas.json (층별 전용면적 합)" },
];

function ScoringLogicPanel() {
  return (
    <div className="mb-6 border-[3px] border-[#0a0a0a] bg-white p-5 shadow-[5px_5px_0_0_#0a0a0a]">
      <div className="mb-4 border-b-[2px] border-[#0a0a0a] pb-3">
        <div className="font-display text-[18px]">🧮 점수 산출 방식</div>
        <p className="mt-1 text-[12px] text-slate-600">
          41개 점포 각각을 4개 평가축으로 채점하고, 가중 평균해 100점 만점 종합 점수를 냅니다.
        </p>
      </div>

      {/* 종합 공식 */}
      <div className="mb-4 border-[2px] border-[#0a0a0a] bg-slate-50 p-3">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-500">종합 점수 = 가중 평균</div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
          {AXES.map((a, i) => (
            <span key={a.key} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-400">+</span>}
              <span className="inline-flex items-center gap-1 border-[2px] border-[#0a0a0a] bg-white px-2 py-1 font-bold">
                <span className="inline-block h-2.5 w-2.5 border border-[#0a0a0a]" style={{ background: a.color }} />
                {a.title.replace(/^[①②③④]\s/, "")}
                <span className="text-slate-500">×{a.weight}%</span>
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          💡 입력값이 없거나 데이터가 빈 축은 평균으로 채우지 않고 <b>가중치를 재정규화해 제외</b>합니다. 동점이면 <b>전용면적 → 브랜드 수</b> 순으로 우선순위를 둡니다.
        </p>
      </div>

      {/* 축별 상세 */}
      <div className="grid grid-cols-2 gap-3">
        {AXES.map((a) => (
          <div key={a.key} className="border-[2px] border-[#0a0a0a] bg-white" style={{ borderTopColor: a.color, borderTopWidth: 6 }}>
            <div className="flex items-baseline justify-between border-b border-slate-200 px-3 py-2">
              <span className="font-display text-[14px]">{a.title}</span>
              <span className="font-mono text-[13px] font-extrabold" style={{ color: a.color }}>{a.weight}%</span>
            </div>
            <p className="px-3 pt-2 text-[11px] text-slate-500">{a.desc}</p>
            <div className="space-y-1.5 p-3">
              {a.rows.map((r) => (
                <div key={r.name} className="text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#0a0a0a]">{r.name}</span>
                    {r.w !== "—" && (
                      <span className="border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] text-slate-500">내부가중 {r.w}</span>
                    )}
                  </div>
                  <div className="text-slate-600">{r.detail}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 데이터 출처 */}
      <div className="mt-4 border-[2px] border-[#0a0a0a] bg-yellow-50 p-3">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-500">데이터 출처 (2026-04 ERP 기준)</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {DATA_SOURCES.map((d) => (
            <div key={d.label} className="flex gap-2">
              <span className="w-16 shrink-0 font-bold text-[#0a0a0a]">{d.label}</span>
              <span className="font-mono text-[10px] text-slate-600">{d.src}</span>
            </div>
          ))}
        </div>
      </div>
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
