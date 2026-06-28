// 브랜드 진단 엔진 (룰 기반, LLM 미사용 = 비용 0)
// 명세: [사실]/[해석]/[가설]/[확인필요] 라벨, 산술 분해는 식과 결과 동시 표기.
// 입력에 없는 축은 [확인필요]로 남기고, 외부 사실을 지어내지 않는다.

import type { OffRank } from "./queries";

export type Label = "사실" | "계산" | "해석" | "가설" | "확인필요" | "질문";
export interface DiagLine { label: Label; text: string; }
export interface DiagSection { title: string; lines: DiagLine[]; }
export interface Diagnosis { sections: DiagSection[]; asOf: string; }

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
  opts: { periodLabel: string; asOf: string; external?: ExternalSignal | null; subLabel?: string },
): Diagnosis {
  const sub = b.bySub ?? [];
  const subLabel = opts.subLabel ?? "지점";
  const newOnes = sub.filter((s) => s.ps === 0 && s.s > 0);   // 신규 (전년 0, 당기 有)
  const closedOnes = sub.filter((s) => s.closed);              // 퇴점
  const totalChange = b.s - b.ps;
  const newSum = newOnes.reduce((t, s) => t + s.s, 0);
  const existChange = totalChange - newSum;
  const existPrev = b.ps;                                      // 신규 전년=0 → 기존 전년합 = 전체 전년
  const pgpm = b.ps > 0 ? (b.pg / b.ps) * 100 : null;

  // ── 1) 관찰 ──────────────────────────────────────────────
  const obs: DiagLine[] = [];
  const newClosedNote = [
    newOnes.length ? `신규 ${newOnes.length}개점` : "",
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
    if (newOnes.length > 0 && totalChange !== 0) {
      const share = (newSum / totalChange) * 100;
      dec.push({ label: "계산", text: `신규 기여 = 신규합 ${fM(newSum)} ÷ 총증감 ${fMs(totalChange)} = ${share.toFixed(0)}% (신규: ${newOnes.map((s) => s.key).join(", ")})` });
      dec.push({ label: "계산", text: `기존점 증감 = 총증감 ${fMs(totalChange)} − 신규 ${fM(newSum)} = ${fMs(existChange)}백만${existPrev > 0 ? `, 기존 성장률 = ${pct1(existChange / existPrev * 100)}` : ""}` });
      dec.push({ label: "해석", text: share >= 60 ? `성장의 ${share.toFixed(0)}%가 출점 효과. 기존점 기여는 ${(100 - share).toFixed(0)}%.` : `출점 기여 ${share.toFixed(0)}% + 기존점 기여 ${(100 - share).toFixed(0)}% 동반.` });
    } else if (newOnes.length === 0) {
      dec.push({ label: "사실", text: `신규 출점 없음 → 증감 ${fMs(totalChange)}백만은 전부 기존점 변동.` });
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

  // ── 4) 가설 ('왜 좋아졌나/나빠졌나'와 '왜 점포·브랜드마다 갈리나'에 답한다) ──
  const hyp: DiagLine[] = [];

  // (A) 출점 vs 동일점: 표면성장 경고 → 출점주도 → (없으면 패스)
  if (b.ps > 0 && newOnes.length > 0 && totalChange > 0) {
    const share = (newSum / totalChange) * 100;
    const existCount = Math.max(b.subCount - newOnes.length, 0);
    const existPctTxt = existPrev > 0 ? pct1(existChange / existPrev * 100) : "전년 0";
    if (existChange < 0) {
      hyp.push({ label: "가설", text: `전체는 ${pct1(b.yoyPct)}지만 신규 ${newOnes.length}개점을 빼면 기존 ${existCount}개점은 ${existPctTxt} — 출점이 동일점 부진을 가린 '표면 성장'. 추가 출점을 멈추면 역성장으로 전환될 위험.\n   확인: 기존점 동일점 추세가 반등하는가, 계속 출점에 의존하는가.` });
    } else if (share >= 60) {
      hyp.push({ label: "가설", text: `성장의 ${share.toFixed(0)}%가 출점 주도 — 기존점만의 성장 동력은 제한적일 수 있음.\n   확인: 기존 ${existCount}개점의 동일점 성장률(${existPctTxt})이 지속되는가.` });
    }
  }

  // (B) 점포 내 분산: 왜 어떤 점포는 성장/하락하는가 (bySub 전년비) — 추가 데이터 0
  const existSub = sub.filter((s) => !s.closed && s.ps > 0);   // 기존점(전년 매출 有)
  if (existSub.length >= 2) {
    const withYoy = existSub.map((s) => ({ s, yoy: (s.s - s.ps) / s.ps * 100, chg: s.s - s.ps }));
    const topGain = [...withYoy].sort((a, c) => c.chg - a.chg)[0];
    const topDrop = [...withYoy].sort((a, c) => a.chg - c.chg)[0];
    const gainers = withYoy.filter((w) => w.yoy > 0);
    const decliners = withYoy.filter((w) => w.yoy < 0);
    const lo = Math.min(...withYoy.map((w) => w.yoy));
    const hi = Math.max(...withYoy.map((w) => w.yoy));
    if (gainers.length > 0 && decliners.length > 0 && topGain.yoy >= 10 && topDrop.yoy <= -10) {
      // 양극화 — 평균이 가린 점포 편차
      hyp.push({ label: "가설", text: `같은 브랜드인데 ${topGain.s.key} ${pct1(topGain.yoy)} / ${topDrop.s.key} ${pct1(topDrop.yoy)}로 갈림 — 브랜드보다 특정 ${subLabel} 요인(입지·MD·인접 경쟁). 평균 ${pct1(b.yoyPct)}이 ${subLabel} 양극화를 가림.\n   확인: 하위 ${topDrop.s.key}의 전용면적·리뉴얼 이력·인접 경쟁 변화.` });
    } else if (existSub.length >= 3 && decliners.length === existSub.length) {
      // 전점 동반 하락 — 점포 아닌 공통 요인
      hyp.push({ label: "가설", text: `기존 ${existSub.length}개점이 전부 하락(${pct1(lo)}~${pct1(hi)}) — 특정 ${subLabel}이 아니라 브랜드/카테고리 공통 요인. ${subLabel} 단위 대응으로는 돌리기 어려움.\n   확인: 동일 카테고리 타 브랜드도 동반 하락인가(시장요인 여부).` });
    } else if (existSub.length >= 3 && gainers.length === existSub.length) {
      // 전점 동반 성장 — 출점 확대 여지
      hyp.push({ label: "가설", text: `기존 ${existSub.length}개점이 전부 성장(${pct1(lo)}~${pct1(hi)}) — 점포 편차가 아닌 브랜드 공통 호조. 출점 확대 여지 점검 대상.\n   확인: 신규 출점 시 자기잠식 없이 증분이 나오는 입지인가.` });
    }
  }

  // (C) 매출-마진 디커플링 (유지)
  if (pgpm !== null && b.yoyPct >= 0 && b.gpm < pgpm) {
    hyp.push({ label: "가설", text: `저마진 성장이 포지션(볼륨·집객)인가, 운영(매입원가·구성) 문제인가.\n   확인: 동일 브랜드 ${subLabel}별 이익률 편차 / 카테고리 믹스.` });
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

  return {
    sections: [
      { title: "1) 관찰", lines: obs },
      { title: "2) 분해", lines: dec },
      { title: "3) 외부 대조", lines: ext },
      { title: "4) 가설", lines: hyp },
    ],
    asOf: opts.asOf,
  };
}
