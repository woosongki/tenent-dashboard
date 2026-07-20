// 브랜드 진단 엔진 (룰 기반, LLM 미사용 = 비용 0)
// 명세: [사실]/[해석]/[가설]/[확인필요] 라벨, 산술 분해는 식과 결과 동시 표기.
// 입력에 없는 축은 [확인필요]로 남기고, 외부 사실을 지어내지 않는다.

import type { OffRank, OffSub } from "./queries";

export type Label = "사실" | "계산" | "해석" | "가설" | "확인필요" | "질문";
export interface DiagLine { label: Label; text: string; }
export interface DiagSection { title: string; lines: DiagLine[]; }

/** 매출증감분해 — BrandDiagnosis 워터폴 그래프 + TOP5 리스트용. */
export interface DecompItem {
  key: string;
  s: number; ps: number;
  growthS: number;                // s - ps
  area: number; prevArea: number;
  reason?: "신규" | "평수증가";   // 신규출점(평수증가 포함) 내부 소분류
}
export interface Decomposition {
  prevTotal: number;
  curTotal: number;
  totalChange: number;
  /** 신규출점(평수증가 포함) 기여 = 순수 신규 당기 매출 합 + 평수증가 지점 증가액(s-ps) 합 */
  newContribution: number;
  /** 기존점(전년 매출 있고 평수 변화 없음/감소) 순증감 */
  existChange: number;
  /** 퇴점 손실 (전년 매출 −, 음수) */
  closedLoss: number;
  /** 신규출점(평수증가 포함) TOP5 — 당기 매출 큰 순 */
  newTop5: DecompItem[];
  /** 기존점 TOP5 — 당기 매출 큰 순 */
  existTop5: DecompItem[];
}
export interface Diagnosis { sections: DiagSection[]; asOf: string; decomposition?: Decomposition; }

/** 네이버 쇼핑 기반 외부 신호 (brand-keyword API 결과 일부) */
export interface ExternalSignal {
  total: number;                       // 검색결과수
  priceMin: number | null;
  priceAvg: number | null;
  priceMax: number | null;
  uniqueSellers: number;               // 판매처수
  relatedKeywords: { keyword: string }[];
  categories: { name: string; pct: number }[];
}

/** 또래(코호트) 통계 — 같은 카테고리/부문 형제 브랜드(또는 형제 지점) 집계. 캘러가 화면의 목록에서 계산해 전달(새 쿼리 0). */
export interface CohortStat {
  label: string;        // 비교 기준 라벨 (예: "캐주얼", "전 부문 지점")
  n: number;            // 또래 수 (자기 포함, 영업 중)
  medianYoy: number;    // 또래 전년비 중앙값(%)
  medianGpm: number;    // 또래 이익률 중앙값(%)
  totalS: number;       // 또래 당기 매출합
  totalPs: number;      // 또래 전년 매출합
}

/** 매출증감분해 계산 — diagnoseBrand 내부와 UI(TOP5 요약 블록) 공용. */
export function computeDecomposition(b: OffRank): Decomposition {
  const sub = b.bySub ?? [];
  const newOnes = sub.filter((s) => s.ps === 0 && s.s > 0);
  const expandedOnes = sub.filter((s) => s.ps > 0 && s.prevArea > 0 && s.area > s.prevArea);
  const closedOnes = sub.filter((s) => s.closed);
  const totalChange = b.s - b.ps;
  const newBrandsSum = newOnes.reduce((t, s) => t + s.s, 0);
  const expandedContrib = expandedOnes.reduce((t, s) => t + (s.s - s.ps), 0);
  const newSum = newBrandsSum + expandedContrib;
  const existChange = totalChange - newSum;
  const closedLoss = -closedOnes.reduce((t, s) => t + s.ps, 0);

  const toItem = (s: OffSub, reason: "신규" | "평수증가"): DecompItem => ({
    key: s.key, s: s.s, ps: s.ps, growthS: s.s - s.ps, area: s.area, prevArea: s.prevArea, reason,
  });
  const newItems: DecompItem[] = [
    ...newOnes.map((s) => toItem(s, "신규")),
    ...expandedOnes.map((s) => toItem(s, "평수증가")),
  ];
  const existItems: DecompItem[] = sub
    .filter((s) => !s.closed && s.ps > 0 && !(s.prevArea > 0 && s.area > s.prevArea))
    .map((s) => ({ key: s.key, s: s.s, ps: s.ps, growthS: s.s - s.ps, area: s.area, prevArea: s.prevArea }));

  return {
    prevTotal: b.ps, curTotal: b.s, totalChange,
    newContribution: newSum, existChange, closedLoss,
    newTop5: [...newItems].sort((a, c) => c.s - a.s).slice(0, 5),
    existTop5: [...existItems].sort((a, c) => c.s - a.s).slice(0, 5),
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const mil = (n: number) => Math.round(n / 1e6);
const fM = (n: number) => mil(n).toLocaleString("ko-KR");          // 백만, 콤마
const fMs = (n: number) => `${n >= 0 ? "+" : ""}${mil(n).toLocaleString("ko-KR")}`;
const won = (n: number) => Math.round(n).toLocaleString("ko-KR");
const pct1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/**
 * 한 브랜드(OffRank+bySub)에 대한 진단. 지점이면 firstColLabel이 '브랜드'지만 동일 로직.
 * @param b 진단 대상 (detailBrands 항목)
 * @param opts.periodLabel "2026 누적" 등, opts.asOf 기준시점 라벨
 */
export function diagnoseBrand(
  b: OffRank,
  opts: { periodLabel: string; asOf: string; external?: ExternalSignal | null; subLabel?: string; cohort?: CohortStat | null },
): Diagnosis {
  const sub = b.bySub ?? [];
  const subLabel = opts.subLabel ?? "지점";
  // 순수 신규 (전년 매출 0, 당기 有)
  const newOnes = sub.filter((s) => s.ps === 0 && s.s > 0);
  // 평수증가 = 전년에도 있었지만 전용면적이 늘어난 지점 (전년 매출 有)
  const expandedOnes = sub.filter((s) => s.ps > 0 && s.prevArea > 0 && s.area > s.prevArea);
  // 신규출점(평수증가 포함) = 신규 + 평수증가 (한 지점을 두 번 세지 않음)
  const newOrExpanded = [...newOnes, ...expandedOnes];
  const closedOnes = sub.filter((s) => s.closed);              // 퇴점
  const totalChange = b.s - b.ps;
  // 기여도: 순수 신규는 당기 매출 전액, 평수증가는 증가분(s-ps)만 편입.
  const newBrandsSum = newOnes.reduce((t, s) => t + s.s, 0);
  const expandedContrib = expandedOnes.reduce((t, s) => t + (s.s - s.ps), 0);
  const newSum = newBrandsSum + expandedContrib;
  const expandedPrev = expandedOnes.reduce((t, s) => t + s.ps, 0);
  const existChange = totalChange - newSum;
  // 기존 전년합 = 전체 전년 − 평수증가 지점 전년 (평수증가 지점의 "잔여 기존" 부분은 기여도에서 이미 뺀 s가 아니라 ps가 남지만,
  // 여기선 "평수증가 지점 자체는 기존점 성장률 계산에서 제외"하는 일관성을 위해 전년합에서도 뺀다).
  const existPrev = b.ps - expandedPrev;
  const pgpm = b.ps > 0 ? (b.pg / b.ps) * 100 : null;

  // ── 1) 관찰 ──────────────────────────────────────────────
  const obs: DiagLine[] = [];
  const newClosedNote = [
    newOrExpanded.length ? `신규출점(평수증가 포함) ${newOrExpanded.length}개점` : "",
    closedOnes.length ? `퇴점 ${closedOnes.length}개점` : "",
  ].filter(Boolean).join(" · ");
  if (b.ps === 0) {
    obs.push({ label: "사실", text: `${b.key}: 당기 매출 ${fM(b.s)}백만(${subLabel} ${b.subCount}개). 전년 동기간 실적 없음(신규/미집계).` });
  } else {
    obs.push({ label: "사실", text: `${b.key}: 전년비 ${pct1(b.yoyPct)}, 당기 매출 ${fM(b.s)}백만(전년 ${fM(b.ps)}백만, ${subLabel} ${b.subCount}개).${newClosedNote ? ` ${newClosedNote} 포함.` : ""}` });
  }

  // ── 2) 분해 ──────────────────────────────────────────────
  const dec: DiagLine[] = [];
  if (b.ps > 0 && sub.length > 0) {
    dec.push({ label: "계산", text: `총 증감 = 당기 ${fM(b.s)} − 전년 ${fM(b.ps)} = ${fMs(totalChange)}백만` });
    if (newOrExpanded.length > 0 && totalChange !== 0) {
      const share = (newSum / totalChange) * 100;
      const parts = [
        newOnes.length ? `신규 ${fM(newBrandsSum)}` : "",
        expandedOnes.length ? `평수증가 +${fM(expandedContrib)}` : "",
      ].filter(Boolean).join(" + ");
      const nameList = newOrExpanded.map((s) => {
        const isExp = s.ps > 0;
        return `${s.key}${isExp ? "(평수증가)" : ""}`;
      }).join(", ");
      dec.push({ label: "계산", text: `신규출점(평수증가 포함) 기여 = ${parts} = ${fM(newSum)} ÷ 총증감 ${fMs(totalChange)} = ${share.toFixed(0)}% (${nameList})` });
      dec.push({ label: "계산", text: `기존점 증감 = 총증감 ${fMs(totalChange)} − 신규출점(평수증가 포함) ${fM(newSum)} = ${fMs(existChange)}백만${existPrev > 0 ? `, 기존 성장률 = ${pct1(existChange / existPrev * 100)}` : ""}` });
      dec.push({ label: "해석", text: share >= 60 ? `성장의 ${share.toFixed(0)}%가 신규출점(평수증가 포함) 효과. 기존점 기여는 ${(100 - share).toFixed(0)}%.` : `신규출점(평수증가 포함) 기여 ${share.toFixed(0)}% + 기존점 기여 ${(100 - share).toFixed(0)}% 동반.` });
    } else if (newOrExpanded.length === 0) {
      dec.push({ label: "사실", text: `신규출점(평수증가 포함) 없음 → 증감 ${fMs(totalChange)}백만은 전부 기존점 변동.` });
    }
  } else if (b.ps === 0) {
    dec.push({ label: "확인필요", text: "전년 실적이 없어 증감 분해 불가(신규 또는 미집계)." });
  }
  // 매출 vs 마진
  if (pgpm !== null) {
    const marginUp = b.gpm >= pgpm;
    const salesUp = b.yoyPct >= 0;
    dec.push({ label: "계산", text: `이익률 = 당기 ${b.gpm}% vs 전년 ${pgpm.toFixed(1)}% (이익 ${fM(b.g)}백만)` });
    if (salesUp && !marginUp) {
      dec.push({ label: "해석", text: `매출은 늘고 이익률은 하락(${pct1(b.yoyPct)} / ${b.gpm}%↓) — 박리다매 성격 가능성. (인과 단정 아님)` });
    } else if (salesUp && marginUp) {
      dec.push({ label: "해석", text: `매출·이익률 같은 방향(↑) — 질적 성장.` });
    } else if (!salesUp) {
      dec.push({ label: "해석", text: `매출 감소(${pct1(b.yoyPct)}), 이익률 ${b.gpm}%(전년 ${pgpm.toFixed(1)}%).` });
    }
  } else {
    dec.push({ label: "확인필요", text: "전년 이익률 없어 마진 방향 비교 불가." });
  }
  // 면적효율
  const withDpp = sub.filter((s) => s.dppSales > 0);
  if (withDpp.length >= 2) {
    const top = [...withDpp].sort((a, c) => c.dppSales - a.dppSales)[0];
    const bot = [...withDpp].sort((a, c) => a.dppSales - c.dppSales)[0];
    const ratio = bot.dppSales > 0 ? top.dppSales / bot.dppSales : 0;
    dec.push({ label: "계산", text: `일평당매출 격차: 최고 ${top.key} ${won(top.dppSales)} vs 최저 ${bot.key} ${won(bot.dppSales)} (원/평·일, ${ratio ? ratio.toFixed(1) + "배" : "-"})` });
    if (ratio >= 2) dec.push({ label: "해석", text: `점포 간 면적효율 ${ratio.toFixed(1)}배 차 — 점포 질 편차 큼.` });
  } else {
    dec.push({ label: "확인필요", text: "전용면적/일평당 데이터 부족으로 면적효율 비교 불가." });
  }

  // ── 3) 외부 대조 ─────────────────────────────────────────
  const ext: DiagLine[] = [];
  const e = opts.external;
  if (e) {
    const priceTxt = e.priceAvg != null ? `평균가 ${won(e.priceAvg)}원${e.priceMin != null && e.priceMax != null ? `(${won(e.priceMin)}~${won(e.priceMax)})` : ""}` : "가격 정보 없음";
    const kw = e.relatedKeywords.slice(0, 5).map((k) => k.keyword).join("·");
    const cat = e.categories.slice(0, 2).map((c) => `${c.name} ${c.pct}%`).join(", ");
    ext.push({ label: "사실", text: `네이버: 검색결과 ${e.total.toLocaleString()}건 · 판매처 ${e.uniqueSellers}곳 · ${priceTxt}${kw ? ` · 키워드 ${kw}` : ""}${cat ? ` · ${cat}` : ""}` });
    // 내부 마진 vs 외부 가격대 방향 대조
    if (pgpm !== null && e.priceAvg != null) {
      const lowMargin = b.gpm < 15;
      ext.push({ label: "해석", text: lowMargin
        ? `내부 저마진(이익률 ${b.gpm}%)과 외부 가격/키워드(저가·볼륨)가 같은 방향으로 관찰됨 (상관 관찰, 인과 아님).`
        : `내부 이익률 ${b.gpm}%와 외부 가격 신호의 방향성은 데이터로 단정 어려움.` });
    }
  } else {
    ext.push({ label: "확인필요", text: "외부 신호(검색량·가격·키워드) 미연결 — '외부 신호 불러오기'로 대조." });
  }

  // ── 4) 가설 (우선순위 순으로 후보를 쌓고 최대 6개로 정리) ──────
  // '왜 좋아/나빠졌나'·'왜 점포마다 갈리나'·'또래 대비 어떤가'에 답한다.
  const hyp: DiagLine[] = [];
  const co = opts.cohort;
  const curSub = sub.filter((s) => !s.closed && s.s > 0);      // 영업 중(당기 매출 有)
  const existSub = sub.filter((s) => !s.closed && s.ps > 0);   // 기존점(전년 매출 有)

  // (J-1) 또래 대비: 시장요인 vs 브랜드요인 ★
  if (co && co.n >= 3 && b.ps > 0) {
    const diff = b.yoyPct - co.medianYoy;
    if (Math.abs(diff) >= 8) {
      hyp.push({ label: "가설", text: diff < 0
        ? `${co.label} 또래 중앙값 ${pct1(co.medianYoy)}인데 이 브랜드 ${pct1(b.yoyPct)} (${diff.toFixed(0)}%p 하회) — 시장 흐름이 아닌 브랜드 고유 약세.\n   확인: 같은 카테고리에서 무엇이 다른가(가격대·MD·매대 위치).`
        : `${co.label} 또래 중앙값 ${pct1(co.medianYoy)} 대비 ${pct1(b.yoyPct)} (+${diff.toFixed(0)}%p 상회) — 시장 평균을 이기는 브랜드 강세.\n   확인: 우위 요인이 지속 가능한가(일시 이벤트 vs 구조적).` });
    }
  }

  // (A) 신규출점(평수증가 포함) vs 동일점: 표면성장 경고 → 출점주도
  if (b.ps > 0 && newOrExpanded.length > 0 && totalChange > 0) {
    const share = (newSum / totalChange) * 100;
    const existCount = Math.max(b.subCount - newOrExpanded.length, 0);
    const existPctTxt = existPrev > 0 ? pct1(existChange / existPrev * 100) : "전년 0";
    if (existChange < 0) {
      hyp.push({ label: "가설", text: `전체는 ${pct1(b.yoyPct)}지만 신규출점(평수증가 포함) ${newOrExpanded.length}개점을 빼면 기존 ${existCount}개점은 ${existPctTxt} — 출점·평수증가이 동일점 부진을 가린 '표면 성장'. 추가 출점을 멈추면 역성장으로 전환될 위험.\n   확인: 기존점 동일점 추세가 반등하는가, 계속 출점·평수증가에 의존하는가.` });
    } else if (share >= 60) {
      hyp.push({ label: "가설", text: `성장의 ${share.toFixed(0)}%가 신규출점(평수증가 포함) 주도 — 기존점만의 성장 동력은 제한적일 수 있음.\n   확인: 기존 ${existCount}개점의 동일점 성장률(${existPctTxt})이 지속되는가.` });
    }
  }

  // (B) 점포 내 분산: 왜 어떤 점포는 성장/하락하는가 (bySub 전년비)
  if (existSub.length >= 2) {
    const withYoy = existSub.map((s) => ({ s, yoy: (s.s - s.ps) / s.ps * 100, chg: s.s - s.ps }));
    const topGain = [...withYoy].sort((a, c) => c.chg - a.chg)[0];
    const topDrop = [...withYoy].sort((a, c) => a.chg - c.chg)[0];
    const gainers = withYoy.filter((w) => w.yoy > 0);
    const decliners = withYoy.filter((w) => w.yoy < 0);
    const lo = Math.min(...withYoy.map((w) => w.yoy));
    const hi = Math.max(...withYoy.map((w) => w.yoy));
    if (gainers.length > 0 && decliners.length > 0 && topGain.yoy >= 10 && topDrop.yoy <= -10) {
      hyp.push({ label: "가설", text: `같은 브랜드인데 ${topGain.s.key} ${pct1(topGain.yoy)} / ${topDrop.s.key} ${pct1(topDrop.yoy)}로 갈림 — 브랜드보다 특정 ${subLabel} 요인(입지·MD·인접 경쟁). 평균 ${pct1(b.yoyPct)}이 ${subLabel} 양극화를 가림.\n   확인: 하위 ${topDrop.s.key}의 전용면적·리뉴얼 이력·인접 경쟁 변화.` });
    } else if (existSub.length >= 3 && decliners.length === existSub.length) {
      hyp.push({ label: "가설", text: `기존 ${existSub.length}개점이 전부 하락(${pct1(lo)}~${pct1(hi)}) — 특정 ${subLabel}이 아니라 브랜드/카테고리 공통 요인. ${subLabel} 단위 대응으로는 돌리기 어려움.\n   확인: 동일 카테고리 타 브랜드도 동반 하락인가(시장요인 여부).` });
    } else if (existSub.length >= 3 && gainers.length === existSub.length) {
      hyp.push({ label: "가설", text: `기존 ${existSub.length}개점이 전부 성장(${pct1(lo)}~${pct1(hi)}) — 점포 편차가 아닌 브랜드 공통 호조. 출점 확대 여지 점검 대상.\n   확인: 신규 출점 시 자기잠식 없이 증분이 나오는 입지인가.` });
    }
  }

  // (E) 퇴점 영향 분리: 구조적 퇴점 vs 영업부진
  if (closedOnes.length > 0 && totalChange !== 0) {
    const closedPrevSum = closedOnes.reduce((t, s) => t + s.ps, 0);
    const continuingChange = totalChange - newSum + closedPrevSum;   // 양년 영업점 증감
    if (closedPrevSum >= Math.abs(totalChange) * 0.3) {
      hyp.push({ label: "가설", text: `총 증감 ${fMs(totalChange)}백만 중 퇴점 ${closedOnes.length}개점이 ${fMs(-closedPrevSum)} — 영업 중인 점포만 보면 ${fMs(continuingChange)}. 영업부진이 아니라 '구조적 퇴점'일 수 있음.\n   확인: 퇴점이 계약만료·리뉴얼인가 실적부진 철수인가.` });
    }
  }

  // (J-2) 또래 내 점유율 변화: 파이를 뺏는가/뺏기는가 ★
  if (co && co.n >= 3 && b.ps > 0 && co.totalS > 0 && co.totalPs > 0) {
    const now = b.s / co.totalS * 100;
    const prev = b.ps / co.totalPs * 100;
    const d = now - prev;
    if (Math.abs(d) >= 1.5) {
      hyp.push({ label: "가설", text: `${co.label} 내 매출비중 ${prev.toFixed(1)}%→${now.toFixed(1)}% (${d >= 0 ? "+" : ""}${d.toFixed(1)}%p) — 또래 파이를 ${d >= 0 ? "뺏는" : "뺏기는"} 중. 절대 성장률과 별개로 ${d >= 0 ? "경쟁우위 강화" : "상대 약화"} 신호.\n   확인: 비중을 ${d >= 0 ? "가져온" : "내준"} 상대 브랜드는 누구인가.` });
    }
  }

  // (F) 매출 집중도(파레토): 특정 점포 의존
  if (curSub.length >= 4) {
    const sorted = [...curSub].sort((a, c) => c.s - a.s);
    const totalCur = sorted.reduce((t, s) => t + s.s, 0);
    const top2Share = totalCur > 0 ? (sorted[0].s + sorted[1].s) / totalCur * 100 : 0;
    if (top2Share >= 60) {
      hyp.push({ label: "가설", text: `상위 2개 ${subLabel}(${sorted[0].key}·${sorted[1].key})이 매출의 ${top2Share.toFixed(0)}% — 특정 ${subLabel} 의존. 그 ${subLabel}의 부진이 곧 브랜드 리스크.\n   확인: 상위 ${subLabel} 계약·리뉴얼 일정과 방어책.` });
    }
  }

  // (G) 규모×효율 4분면: 대형 저효율
  const dppSub = sub.filter((s) => !s.closed && s.s > 0 && s.dppSales > 0);
  if (dppSub.length >= 4) {
    const medS = median(dppSub.map((s) => s.s));
    const medDpp = median(dppSub.map((s) => s.dppSales));
    const bigLow = dppSub.filter((s) => s.s >= medS && s.dppSales <= medDpp * 0.7)
      .sort((a, c) => a.dppSales - c.dppSales)[0];
    if (bigLow) {
      hyp.push({ label: "가설", text: `${bigLow.key} ${subLabel}은 매출은 상위권인데 일평당 효율은 하위권(${won(bigLow.dppSales)}원/평·일) — 면적 과다(대형 저효율) 가설. 면적 조정·리뉴얼 우선 후보.\n   확인: 해당 ${subLabel}의 전용면적 대비 적정 평효율 벤치마크.` });
    }
  }

  // (H) 신규점 안착도
  if (newOnes.length > 0 && existSub.length >= 2) {
    const newDpp = newOnes.filter((s) => s.dppSales > 0);
    const medExistDpp = median(existSub.filter((s) => s.dppSales > 0).map((s) => s.dppSales));
    if (newDpp.length > 0 && medExistDpp > 0) {
      const worst = [...newDpp].sort((a, c) => a.dppSales - c.dppSales)[0];
      const ratio = worst.dppSales / medExistDpp * 100;
      if (ratio < 60) {
        hyp.push({ label: "가설", text: `신규 ${worst.key} 일평당이 기존점 중앙값의 ${ratio.toFixed(0)}% — 아직 미안착. 출점 기여를 곧이곧대로 보면 성장 동력을 과대평가할 수 있음.\n   확인: 신규점 통상 안착 기간 대비 현재 위치.` });
      }
    }
  }

  // (I) 이익률 분산: 매출 아닌 수익성 편차
  if (curSub.length >= 3) {
    const gpms = curSub.map((s) => ({ s, gpm: s.s > 0 ? s.g / s.s * 100 : 0 }));
    const hiG = [...gpms].sort((a, c) => c.gpm - a.gpm)[0];
    const loG = [...gpms].sort((a, c) => a.gpm - c.gpm)[0];
    const spread = hiG.gpm - loG.gpm;
    if (spread >= 15) {
      hyp.push({ label: "가설", text: `${subLabel}별 이익률 ${loG.gpm.toFixed(0)}%~${hiG.gpm.toFixed(0)}% (${spread.toFixed(0)}%p 차) — 매출이 아닌 수익성 편차. 저마진 ${loG.s.key}의 매입원가·할인·구성 점검.\n   확인: 저마진 ${subLabel}가 의도된 집객용인가 비효율인가.` });
    }
  }

  // (C) 매출-마진 디커플링 (유지)
  if (pgpm !== null && b.yoyPct >= 0 && b.gpm < pgpm) {
    hyp.push({ label: "가설", text: `저마진 성장이 포지션(볼륨·집객)인가, 운영(매입원가·구성) 문제인가.\n   확인: 동일 브랜드 ${subLabel}별 이익률 편차 / 카테고리 믹스.` });
  }

  // (J-3) 마진 포지셔닝: 또래 대비 고/저마진 ★
  if (co && co.n >= 3 && co.medianGpm > 0 && b.s > 0) {
    const md = b.gpm - co.medianGpm;
    if (Math.abs(md) >= 5) {
      hyp.push({ label: "가설", text: `이익률 ${b.gpm}% vs ${co.label} 또래 중앙 ${co.medianGpm.toFixed(1)}% (${md >= 0 ? "+" : ""}${md.toFixed(1)}%p) — ${md >= 0 ? "또래보다 고마진 포지션" : "구조적 저마진 포지션"}.\n   확인: ${md >= 0 ? "고마진을 지키는 진입장벽은 무엇인가" : "저마진이 카테고리 특성인가 협상력 문제인가"}.` });
    }
  }

  // (D) 면적효율 격차 (유지)
  if (withDpp.length >= 2) {
    const top = [...withDpp].sort((a, c) => c.dppSales - a.dppSales)[0];
    const bot = [...withDpp].sort((a, c) => a.dppSales - c.dppSales)[0];
    if (bot.dppSales > 0 && top.dppSales / bot.dppSales >= 2) {
      hyp.push({ label: "가설", text: `${subLabel} 간 면적효율 격차의 원인 — 입지/면적 vs 운영.\n   확인: 저효율 ${bot.key}의 전용면적·매장수·인접 경쟁 구성.` });
    }
  }

  if (hyp.length === 0 && b.ps > 0) {
    hyp.push({ label: "해석", text: "2)·3) 분해로 변화가 대체로 설명됨 — 추가 가설 불필요." });
  }
  // 과다 노출 방지: 우선순위 상위 6개까지만 노출
  const hypShown = hyp.length > 6 ? hyp.slice(0, 6) : hyp;

  const decomposition = computeDecomposition(b);

  return {
    sections: [
      { title: "1) 관찰", lines: obs },
      { title: "2) 분해", lines: dec },
      { title: "3) 외부 대조", lines: ext },
      { title: "4) 가설", lines: hypShown },
    ],
    asOf: opts.asOf,
    decomposition,
  };
}
