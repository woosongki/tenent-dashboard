// 매출 증감의 대칭(Shapley) 분해 — 서버 의존 없음(순수 함수, 테스트 용이).
//
// 매출 S = 면적 A × 평당매출 E(=S/A). 당기(1) vs 전기(0)의 증감 ΔS = S1 − S0 을
// '면적 효과'와 '평당(좌판)효율 효과'로 가른다. 대칭 분해라 기준연도 선택에 무관하고,
// 두 효과의 합은 정확히 ΔS 와 일치(교차항을 반씩 배분).
//
//   면적효과 = (A1 − A0)/2 · (E0 + E1) = (A1 − A0)/2 · (S0/A0 + S1/A1)
//   효율효과 = (A1 + A0)/2 · (E1 − E0) = (A1 + A0)/2 · (S1/A1 − S0/A0)
//
// 전기 실적/면적이 없으면(신규) 분해 불가 → {0,0} 반환(호출부에서 '신규 기여'로 처리).
export function decomposeSymmetric(
  s1: number, s0: number, a1: number, a0: number,
): { areaEffect: number; effEffect: number } {
  if (!(s1 > 0 && s0 > 0 && a1 > 0 && a0 > 0)) return { areaEffect: 0, effEffect: 0 };
  const e1 = s1 / a1, e0 = s0 / a0;
  return {
    areaEffect: ((a1 - a0) / 2) * (e0 + e1),
    effEffect: ((a1 + a0) / 2) * (e1 - e0),
  };
}
