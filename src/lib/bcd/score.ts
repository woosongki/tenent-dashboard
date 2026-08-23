/**
 * BCD (Brand Concept Degree) 채점 함수 — 단일 소스
 *
 * 설계원칙(PRD 03절 #4): "채점 함수는 서버 한 곳만" — 화면·배치(P3 자동수집 후 재계산)·
 * 미리보기(/api/bcd/score/preview)가 전부 이 파일의 scoreBrand()/scorePool()을 부른다.
 * 다른 곳에서 점수 계산 로직을 복제하지 않는다.
 *
 * 참조: BCD_브랜드컨셉등급제_PRD_v1.0
 */

// ── 타입 ─────────────────────────────────────────────────────────────────

export type CriterionMode = 'abs' | 'pct' | 'sel' | 'band';

export interface Criterion {
  code: string;          // 'C1' ... 'C8'
  name: string;
  weight: number;        // 만점
  mid: number;            // 중 점수
  mode: CriterionMode;
  t1: number;              // 상 기준 (abs: 절대값 · pct: 백분위 0~100)
  t2: number;              // 중 기준
  /** mode='band' 전용: 원값이 min 이상이면 score. 내림차순으로 첫 매칭 채택, 없으면 0. */
  bands?: { min: number; score: number }[];
  unit?: string;
  note?: string;
}

export interface Ruleset {
  base: Criterion[];                       // 합이 100이어야 함 (저장 시 검증, PRD 10.1절)
  bonus: Criterion;                         // C7. 기본 배점에 포함되지 않음
  cuts: { A: number; Bp: number; B: number; C: number };
  na_policy: { max_na_points: number; over_status: string };
  pct_min_sample: number;                   // 이 미만이면 분포 채점 경고
}

/** 브랜드 1건의 지표 원값. null이면 결측(N/A) — 0과 구분(PRD 08.2절 핵심). */
export type MetricValues = Partial<Record<string, number | null>>;

export interface BrandInput {
  id: string;
  category_major: string;
  category_minor: string;
  online_applicable: boolean;
  values: MetricValues;     // { C1: 12, C2: 3, ..., C7: 2, C8: 5 }
  na_reasons?: Partial<Record<string, string>>;
  flag?: { type: 'knockout' | 'override'; adjustment?: number } | null;
}

export interface CriterionResult {
  value: number | null;
  score: number | null;     // null이면 N/A
  rank?: number;             // mode='pct'일 때만: 0~100 백분위
  comparisonGroup?: string;  // 'category_minor:침구·매트리스' | 'category_major:홈·리빙'
  comparisonSize?: number;
}

export interface ScoreResult {
  brandId: string;
  baseScore: number;         // 100점 환산
  bonusScore: number;
  total: number;              // base + bonus (최대 105)
  grade: 'A' | 'B+' | 'B' | 'C' | 'N' | 'H' | '미평가';
  naCodes: string[];
  naPoints: number;
  breakdown: Record<string, CriterionResult>;
  searchPosition: '성장' | '둔화' | '신흥' | '침체' | null;
}

// ── 분포(백분위) 계산 ─────────────────────────────────────────────────────

/**
 * 비교군을 결정한다. 중분류 표본이 pct_min_sample 미만이면 대분류로 확대한다.
 * (PRD 13.1절: "비교군 내 최고값이 '중' 기준에도 못 미치면 N/A" 규칙과는 별개 —
 *  이건 표본 수 부족에 대한 확대이고, 검토요청 #9는 절대지표 업종격차에 대한 확대다.
 *  두 로직 모두 아래 scorePool()에서 함께 처리한다.)
 */
function resolveComparisonGroup(
  brand: BrandInput,
  pool: BrandInput[],
  minSample: number
): { key: string; group: BrandInput[] } {
  const minorGroup = pool.filter(b => b.category_minor === brand.category_minor);
  if (minorGroup.length >= minSample) {
    return { key: `category_minor:${brand.category_minor}`, group: minorGroup };
  }
  const majorGroup = pool.filter(b => b.category_major === brand.category_major);
  return { key: `category_major:${brand.category_major}`, group: majorGroup };
}

/** v가 pool 중 몇 % 이하인지 (동순위는 <=로 포함, 0~100). */
function percentileRank(v: number, pool: number[]): number | null {
  if (pool.length === 0) return null;
  const le = pool.filter(x => x <= v).length;
  return Math.round((le / pool.length) * 100);
}

// ── 검토요청 #9: 비교군 내 절대지표가 구조적으로 불가능하면 N/A ───────────
// (PRD 13.2절: 세탁 비교군은 C1에서 전원 0점 — 업종 구조 때문이지 브랜드 문제가 아님)

function isStructurallyImpossible(
  criterion: Criterion,
  brand: BrandInput,
  pool: BrandInput[]
): boolean {
  if (criterion.mode !== 'abs') return false;
  // C1(벤치마크 입점률): "입점 없음 = 0% = 0점"이 정본(업종 무관). 구조적 N/A 적용하지 않는다.
  if (criterion.code === 'C1') return false;
  const peers = pool.filter(b => b.category_minor === brand.category_minor);
  if (peers.length === 0) return false;
  const maxInGroup = Math.max(
    ...peers.map(b => (b.values[criterion.code] ?? -Infinity) as number)
  );
  return maxInGroup < criterion.t2; // 비교군 전체 최고값도 '중' 기준 미달
}

// ── 지표 1개 채점 ────────────────────────────────────────────────────────

function scoreCriterion(
  criterion: Criterion,
  brand: BrandInput,
  pool: BrandInput[],
  minSample: number
): CriterionResult {
  let raw = brand.values[criterion.code];

  // C1(벤치마크 입점률): 미측정도 "입점 없음 = 0% = 0점"으로 취급 — 절대 N/A로 두지 않는다.
  if ((raw === null || raw === undefined) && criterion.code === 'C1') raw = 0;

  if (raw === null || raw === undefined) {
    return { value: null, score: null };
  }

  // 검토요청 #9 규칙: 비교군 구조상 불가능하면 N/A (0점이 아니라)
  if (isStructurallyImpossible(criterion, brand, pool)) {
    return { value: raw, score: null };
  }

  if (criterion.mode === 'sel') {
    const s = Math.max(0, Math.min(criterion.weight, raw));
    return { value: raw, score: Math.round(s) };
  }

  if (criterion.mode === 'abs') {
    const s = raw >= criterion.t1 ? criterion.weight : raw >= criterion.t2 ? criterion.mid : 0;
    return { value: raw, score: s };
  }

  // 구간(band): 원값이 min 이상인 첫 구간의 score(내림차순), 없으면 0. 3단계 이상 표현용.
  if (criterion.mode === 'band') {
    const bands = [...(criterion.bands ?? [])].sort((a, b) => b.min - a.min);
    let s = 0;
    for (const b of bands) { if (raw >= b.min) { s = b.score; break; } }
    return { value: raw, score: s };
  }

  // mode === 'pct'
  const { key, group } = resolveComparisonGroup(brand, pool, minSample);
  const poolValues = group
    .map(b => b.values[criterion.code])
    .filter((v): v is number => v !== null && v !== undefined);
  const rank = percentileRank(raw, poolValues);
  if (rank === null) return { value: raw, score: null, comparisonGroup: key, comparisonSize: poolValues.length };
  const s = rank >= criterion.t1 ? criterion.weight : rank >= criterion.t2 ? criterion.mid : 0;
  return { value: raw, score: s, rank, comparisonGroup: key, comparisonSize: poolValues.length };
}

// ── 가점(C7) ─────────────────────────────────────────────────────────────

function scoreBonus(criterion: Criterion, brand: BrandInput): CriterionResult {
  if (!brand.online_applicable) {
    return { value: null, score: 0 }; // 해당없음 — 0점이지만 N/A 아님, 감점도 아님(PRD 06절)
  }
  const raw = brand.values[criterion.code];
  if (raw === null || raw === undefined) return { value: null, score: 0 };
  const s = raw >= criterion.t1 ? criterion.weight : raw >= criterion.t2 ? criterion.mid : 0;
  return { value: raw, score: s };
}

// ── 등급 컷 ──────────────────────────────────────────────────────────────

function gradeFromTotal(total: number, cuts: Ruleset['cuts']): ScoreResult['grade'] {
  if (total >= cuts.A) return 'A';
  if (total >= cuts.Bp) return 'B+';
  if (total >= cuts.B) return 'B';
  if (total >= cuts.C) return 'C';
  return 'N';
}

// ── 검색 포지션 (C4 수준 × C5 추세, PRD 05절) ──────────────────────────

function resolveSearchPosition(
  breakdown: Record<string, CriterionResult>
): ScoreResult['searchPosition'] {
  const r4 = breakdown['C4']?.rank;
  const r5 = breakdown['C5']?.rank;
  if (r4 === undefined || r5 === undefined) return null;
  if (r4 >= 50 && r5 >= 50) return '성장';
  if (r4 >= 50 && r5 < 50) return '둔화';
  if (r4 < 50 && r5 >= 50) return '신흥';
  return '침체';
}

// ── 메인: 브랜드 1건 채점 ────────────────────────────────────────────────

/**
 * @param brand 채점 대상 브랜드
 * @param pool  분포(pct) 채점의 비교군 후보 전체 — 보통 scope_status='active'인 전 브랜드
 * @param ruleset 활성 ruleset (bcd_rulesets.is_active=true, definition 컬럼)
 */
export function scoreBrand(brand: BrandInput, pool: BrandInput[], ruleset: Ruleset): ScoreResult {
  // 부적격(H)은 점수 계산 자체를 건너뛴다 — 점수가 있어도 무의미(PRD 08.3절)
  if (brand.flag?.type === 'knockout') {
    return {
      brandId: brand.id, baseScore: 0, bonusScore: 0, total: 0, grade: 'H',
      naCodes: [], naPoints: 0, breakdown: {}, searchPosition: null,
    };
  }

  const breakdown: Record<string, CriterionResult> = {};
  let earned = 0;
  let denom = 0;
  const naCodes: string[] = [];
  let naPoints = 0;

  for (const c of ruleset.base) {
    const r = scoreCriterion(c, brand, pool, ruleset.pct_min_sample);
    breakdown[c.code] = r;
    if (r.score === null) {
      naCodes.push(c.code);
      naPoints += c.weight;
    } else {
      earned += r.score;
      denom += c.weight;
    }
  }

  const bonusResult = scoreBonus(ruleset.bonus, brand);
  breakdown[ruleset.bonus.code] = bonusResult;

  const overNaLimit = naPoints > ruleset.na_policy.max_na_points;
  const baseScore = denom > 0 ? Math.round((earned / denom) * 100) : 0;
  const bonusScore = bonusResult.score ?? 0;
  let total = baseScore + bonusScore;

  // Override 조정 (점수를 고치는 게 아니라 결과에 가산 — 이력은 bcd_flags에 별도 기록)
  if (brand.flag?.type === 'override' && typeof brand.flag.adjustment === 'number') {
    total += brand.flag.adjustment;
  }

  const grade: ScoreResult['grade'] = overNaLimit
    ? '미평가'
    : gradeFromTotal(total, ruleset.cuts);

  return {
    brandId: brand.id,
    baseScore,
    bonusScore,
    total,
    grade,
    naCodes,
    naPoints,
    breakdown,
    searchPosition: resolveSearchPosition(breakdown),
  };
}

/** 전 브랜드 일괄 채점. 기준 편집 화면의 "저장 전 미리보기"(PRD 10.1절)가 이걸 부른다. */
export function scorePool(pool: BrandInput[], ruleset: Ruleset): ScoreResult[] {
  return pool.map(b => scoreBrand(b, pool, ruleset));
}

/**
 * 저장 가능 여부 검증. base weight 합이 100이 아니면 저장을 막는다(PRD 10.1절).
 */
export function validateRuleset(ruleset: Ruleset): { ok: boolean; sum: number; message: string } {
  const sum = ruleset.base.reduce((a, c) => a + c.weight, 0);
  if (sum !== 100) {
    return { ok: false, sum, message: `기본 배점 합 ${sum} · 100과 ${sum - 100 > 0 ? '+' : ''}${sum - 100} 차이 · 저장 차단` };
  }
  return { ok: true, sum, message: `기본 배점 합 100 · 저장 가능 (최대 ${100 + ruleset.bonus.weight}점)` };
}

/**
 * 기준 변경 전/후 비교 — "등급 변동 N건" 미리보기 생성 (PRD 10.1절 필수 단계).
 */
export function diffGrades(
  before: ScoreResult[],
  after: ScoreResult[]
): { brandId: string; before: string; after: string }[] {
  const beforeMap = new Map(before.map(r => [r.brandId, r.grade]));
  const changed: { brandId: string; before: string; after: string }[] = [];
  for (const r of after) {
    const prev = beforeMap.get(r.brandId);
    if (prev && prev !== r.grade) {
      changed.push({ brandId: r.brandId, before: prev, after: r.grade });
    }
  }
  return changed;
}
