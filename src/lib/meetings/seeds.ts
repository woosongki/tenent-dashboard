import "server-only";
import type { MeetingBriefPayload } from "./brief";

export interface SeedQuestion {
  id: string;
  category: "재무" | "출점·확장" | "리스크" | "조직" | "거래조건" | "마케팅";
  q: string;
  rationale: string; // 왜 이 질문이 나왔는지 (브리프 어떤 신호에서 도출됐는지)
}

/**
 * brief payload의 신호에서 미팅 질문 3-5개 자동 생성 (LLM 없음).
 * 우선순위: 큰 신호 → 보편 질문 순서로 채움.
 */
export function buildSeedQuestions(payload: MeetingBriefPayload): SeedQuestion[] {
  const out: SeedQuestion[] = [];
  let n = 0;
  const id = () => `s${++n}`;

  // 1) 검색 트렌드 모멘텀
  if (payload.trend) {
    const { momentum, momentumPct } = payload.trend;
    if (momentum === "rising" && momentumPct >= 20) {
      out.push({
        id: id(),
        category: "마케팅",
        q: `최근 3개월 검색량이 ${momentumPct > 0 ? "+" : ""}${momentumPct}% 상승했는데, 이슈/캠페인이 있었나요? 다음 분기 마케팅 계획은?`,
        rationale: `검색 모멘텀 ${momentum} ${momentumPct}%`,
      });
    } else if (momentum === "declining" && momentumPct <= -20) {
      out.push({
        id: id(),
        category: "마케팅",
        q: `검색량이 ${momentumPct}% 감소세인데, 트래픽 회복을 위한 대응 계획이 있나요?`,
        rationale: `검색 모멘텀 ${momentum} ${momentumPct}%`,
      });
    }
  }

  // 2) 재무 — YoY 큰 변동
  const latest = payload.financials[0];
  const prev = payload.financials[1];
  if (latest?.revenue && prev?.revenue) {
    const yoy = ((latest.revenue - prev.revenue) / prev.revenue) * 100;
    if (Math.abs(yoy) >= 15) {
      const sign = yoy > 0 ? "+" : "";
      out.push({
        id: id(),
        category: "재무",
        q: `${latest.year} 매출이 전년 대비 ${sign}${yoy.toFixed(1)}% 변동했는데, 주요 동인은 무엇인가요?`,
        rationale: `매출 YoY ${sign}${yoy.toFixed(1)}%`,
      });
    }
    // 영업이익 적자
    if ((latest.operatingProfit ?? 0) < 0) {
      out.push({
        id: id(),
        category: "재무",
        q: `${latest.year} 영업이익 적자의 주요 원인과 흑자 전환 시점 전망은?`,
        rationale: "영업이익 적자",
      });
    }
  } else if (payload.dart && payload.financials.every((f) => f.revenue === null)) {
    // 외감업체 — DART OpenAPI에서 재무 미수집
    out.push({
      id: id(),
      category: "재무",
      q: "최근 3년 매출 추이와 영업이익 수준을 공유 가능할까요? (감사보고서/IR 자료)",
      rationale: "DART 재무 미수집(외감업체 가능성)",
    });
  }

  // 3) 뉴스 카테고리 신호
  if (payload.news.length > 0) {
    const counts = new Map<string, number>();
    payload.news.forEach((n) => counts.set(n.category, (counts.get(n.category) ?? 0) + 1));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const [topCat, topCount] = sorted[0];

    if (topCat === "출점·매장 전략" && topCount >= 3) {
      out.push({
        id: id(),
        category: "출점·확장",
        q: `최근 출점 관련 보도가 ${topCount}건 있었는데, 26년 신규 출점 계획과 희망 입지 조건은?`,
        rationale: `뉴스 카테고리 출점·매장 전략 ${topCount}건`,
      });
    } else if (topCat === "법적·규제 이슈" && topCount >= 2) {
      out.push({
        id: id(),
        category: "리스크",
        q: `최근 ${topCount}건의 규제/법적 이슈 관련 보도가 있는데, 현재 상황과 사업 영향은?`,
        rationale: `뉴스 카테고리 법적·규제 ${topCount}건`,
      });
    } else if (topCat === "인사·조직 변동" && topCount >= 2) {
      out.push({
        id: id(),
        category: "조직",
        q: `최근 인사/조직 변동 관련 보도가 있는데, 핵심 의사결정자 또는 영업 담당자는 누구인가요?`,
        rationale: `뉴스 카테고리 인사·조직 ${topCount}건`,
      });
    } else if (topCat === "재무 이벤트" && topCount >= 2) {
      out.push({
        id: id(),
        category: "재무",
        q: `최근 ${topCount}건의 재무 이벤트(투자 유치/M&A 등) 관련 보도가 있는데, 현재 자금조달 상황은?`,
        rationale: `뉴스 카테고리 재무 이벤트 ${topCount}건`,
      });
    }
  }

  // 4) 보편 질문 채우기 — 3건 미만이면 추가
  const fillers: SeedQuestion[] = [
    {
      id: "",
      category: "출점·확장",
      q: "이번 미팅에서 우선적으로 논의하고 싶은 입지/매장 규모/계약 형태는?",
      rationale: "보편 — 출점 요건",
    },
    {
      id: "",
      category: "거래조건",
      q: "수수료/임대료 구조에 대한 기대 수준과 직전 입점처 조건은 어떻게 되나요?",
      rationale: "보편 — 거래조건",
    },
    {
      id: "",
      category: "출점·확장",
      q: "최근 1년간 신규 입점한 채널과 거기서의 성과/이슈는?",
      rationale: "보편 — 채널 실적",
    },
  ];
  for (const f of fillers) {
    if (out.length >= 5) break;
    if (out.some((o) => o.category === f.category)) continue; // 카테고리 중복 회피
    out.push({ ...f, id: id() });
  }

  // 최소 3건 보장 (필러도 카테고리 중복으로 모두 걸러진 극단 케이스)
  while (out.length < 3 && out.length < fillers.length) {
    const f = fillers[out.length];
    out.push({ ...f, id: id() });
  }

  return out.slice(0, 5);
}
