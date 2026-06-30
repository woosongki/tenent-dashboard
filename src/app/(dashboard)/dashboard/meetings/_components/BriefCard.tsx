"use client";

import type {
  DartCompany,
  FinancialYear,
  DartDisclosure,
  NewsArticle,
  NewsCategory,
  SearchTrend,
  SourceReliability,
} from "@/lib/verify/types";

export interface BriefPayload {
  brand: string;
  company: string | null;
  corpCode: string | null;
  corpCls: DartCompany["corpCls"];
  dart: DartCompany | null;
  financials: FinancialYear[];
  disclosures: DartDisclosure[];
  news: NewsArticle[];
  trend: SearchTrend | null;
  fetchedAt: string;
}

export interface BriefRow {
  id: string;
  brand: string;
  company: string | null;
  corp_code: string | null;
  stage: string;
  brief_payload: BriefPayload;
  brief_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const KRW_BILLION = 100_000_000;

function fmtBillion(won: number | null | undefined): string {
  if (!won || !Number.isFinite(won)) return "—";
  if (won >= 1_000 * KRW_BILLION) return `${(won / (1_000 * KRW_BILLION)).toFixed(1)}조`;
  if (won >= KRW_BILLION) return `${(won / KRW_BILLION).toFixed(0)}억`;
  return `${(won / 10_000).toFixed(0)}만`;
}

function calcYoY(curr: number | null, prev: number | null): number | null {
  if (!curr || !prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function corpClsLabel(cls: DartCompany["corpCls"]): string {
  if (cls === "Y") return "유가증권 상장";
  if (cls === "K") return "코스닥 상장";
  if (cls === "E") return "외부감사 (비상장)";
  if (cls === "N") return "비상장";
  return "—";
}

function fmtKoreanDate(raw: string | null): string {
  if (!raw) return "—";
  // DART: yyyymmdd
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
  }
  return raw;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function KpiBox({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "highlight" | "rise" | "fall";
}) {
  const bg =
    accent === "highlight" ? "bg-yellow-300"
    : accent === "rise" ? "bg-emerald-300"
    : accent === "fall" ? "bg-rose-300"
    : "bg-white";
  return (
    <div className={`brutal overflow-hidden p-3 sm:p-5 ${bg}`}>
      <p className="mb-2 truncate text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
        {label}
      </p>
      <p className="font-mono text-[18px] sm:text-[24px] md:text-[28px] font-extrabold tabular-nums leading-none whitespace-nowrap text-[#0a0a0a]">
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
      {children}
    </p>
  );
}

const NEWS_COLOR: Record<NewsCategory, string> = {
  "출점·매장 전략": "bg-yellow-300",
  "카테고리 확장": "bg-cyan-400",
  "인프라·물류": "bg-violet-300",
  "법적·규제 이슈": "bg-rose-300",
  "인사·조직 변동": "bg-emerald-300",
  "재무 이벤트": "bg-amber-300",
  "온·오프 연계": "bg-cyan-300",
  "기타": "bg-white",
};

function ReliabilityBadge({ r }: { r: SourceReliability }) {
  const map: Record<SourceReliability, string> = {
    "검증됨": "bg-emerald-300",
    "보도 확인": "bg-cyan-300",
    "참고": "bg-amber-300",
    "확인 불가": "bg-rose-200",
  };
  return (
    <span className={`inline-block border-[1.5px] border-[#0a0a0a] ${map[r]} px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wider`}>
      {r}
    </span>
  );
}

interface Props {
  row: BriefRow;
  cached: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function BriefCard({ row, cached, onRefresh, refreshing }: Props) {
  const p = row.brief_payload;
  const latest = p.financials[0];
  const prev = p.financials[1];
  const yoy = calcYoY(latest?.revenue ?? null, prev?.revenue ?? null);

  // 매출 그래프용 max
  const revMax = Math.max(...p.financials.map((f) => f.revenue ?? 0), 1);
  const opMax = Math.max(...p.financials.map((f) => Math.abs(f.operatingProfit ?? 0)), 1);

  // 뉴스 카테고리별 그룹
  const newsByCat = new Map<NewsCategory, NewsArticle[]>();
  p.news.forEach((n) => {
    const arr = newsByCat.get(n.category) ?? [];
    arr.push(n);
    newsByCat.set(n.category, arr);
  });
  const newsCats = [...newsByCat.entries()].sort((a, b) => b[1].length - a[1].length);

  // 트렌드 그래프용
  const trendMax = p.trend ? Math.max(...p.trend.monthly.map((m) => m.ratio), 1) : 1;

  return (
    <div className="space-y-5">
      {/* 헤더 + 캐시 인디케이터 */}
      <div className="brutal bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="font-display text-[28px] sm:text-[36px] leading-[1] text-[#0a0a0a]">
                {row.brand}
              </h2>
              {p.company && p.company !== row.brand && (
                <span className="font-mono text-[14px] font-bold text-[#0a0a0a]/55 truncate">
                  · {p.company}
                </span>
              )}
            </div>
            <p className="mt-2 text-[13px] text-[#0a0a0a]/70 leading-relaxed">
              {row.brief_summary ?? "요약 없음"}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <span className={`border-[2px] border-[#0a0a0a] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
              cached ? "bg-cyan-300" : "bg-emerald-300"
            }`}>
              {cached ? "캐시 · 24h 내" : "방금 수집"}
            </span>
            <span className="font-mono text-[10px] text-[#0a0a0a]/55">
              {relativeTime(p.fetchedAt)}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="mt-1 border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1.5 text-[11px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
            >
              {refreshing ? "재수집 중..." : "강제 재수집"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI 5칸 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <KpiBox
          label="상장구분"
          value={p.dart ? corpClsLabel(p.corpCls).split(" ")[0] : "—"}
        />
        <KpiBox
          label={latest ? `${latest.year} 매출` : "매출"}
          value={fmtBillion(latest?.revenue)}
          accent="highlight"
        />
        <KpiBox
          label="YoY"
          value={yoy === null ? "—" : `${yoy > 0 ? "+" : ""}${yoy}%`}
          accent={yoy === null ? "default" : yoy > 0 ? "rise" : "fall"}
        />
        <KpiBox
          label="검색 모멘텀"
          value={
            p.trend
              ? `${p.trend.momentumPct > 0 ? "+" : ""}${p.trend.momentumPct}%`
              : "—"
          }
          accent={
            !p.trend ? "default"
              : p.trend.momentum === "rising" ? "rise"
              : p.trend.momentum === "declining" ? "fall"
              : "default"
          }
        />
        <KpiBox label="뉴스" value={`${p.news.length}건`} />
      </div>

      {/* ROW 2: DART 기본 정보 + 재무 추이 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DART 기본 */}
        <div className="brutal bg-white p-5">
          <SectionHeader>회사 정보 (DART)</SectionHeader>
          {!p.dart ? (
            <p className="text-[12px] text-[#0a0a0a]/55">
              DART 매칭 없음 (corp_code 미발견). 자유 입력 브랜드이거나 비공시 법인일 수 있습니다.
            </p>
          ) : (
            <dl className="space-y-2 text-[12.5px]">
              <Row label="정식명">{p.dart.corpName}</Row>
              <Row label="상장">{corpClsLabel(p.corpCls)}</Row>
              <Row label="대표자">{p.dart.repName ?? "—"}</Row>
              <Row label="설립일">{fmtKoreanDate(p.dart.est_dt)}</Row>
              <Row label="결산월">{p.dart.acc_mt ? `${p.dart.acc_mt}월` : "—"}</Row>
              <Row label="주소" multiline>{p.dart.adres ?? "—"}</Row>
              {p.dart.hm_url && (
                <Row label="홈페이지">
                  <a
                    href={p.dart.hm_url.startsWith("http") ? p.dart.hm_url : `https://${p.dart.hm_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-2 underline-offset-2 hover:bg-yellow-300"
                  >
                    {p.dart.hm_url}
                  </a>
                </Row>
              )}
              {p.dart.bizrNo && <Row label="사업자번호">{p.dart.bizrNo}</Row>}
            </dl>
          )}
        </div>

        {/* 재무 추이 */}
        <div className="brutal bg-white p-5">
          <SectionHeader>재무 추이 (최근 {p.financials.length}년)</SectionHeader>
          {p.financials.length === 0 ? (
            <p className="text-[12px] text-[#0a0a0a]/55">재무 데이터 없음 (외감 미신고이거나 신생법인)</p>
          ) : (
            <div className="space-y-3">
              {p.financials.map((f) => {
                const revPct = f.revenue ? (f.revenue / revMax) * 100 : 0;
                const opPct = f.operatingProfit ? (Math.abs(f.operatingProfit) / opMax) * 100 : 0;
                const opLoss = (f.operatingProfit ?? 0) < 0;
                return (
                  <div key={f.year}>
                    <div className="flex items-center justify-between text-[12px] mb-1.5">
                      <span className="font-extrabold text-[#0a0a0a]">{f.year}</span>
                      <span className="font-mono font-bold text-[#0a0a0a]/70">
                        매출 {fmtBillion(f.revenue)} · 영익 {opLoss ? "▼" : ""}{fmtBillion(Math.abs(f.operatingProfit ?? 0))}
                      </span>
                    </div>
                    <div className="h-4 border-[2px] border-[#0a0a0a] bg-[#FAF7EC]">
                      <div
                        className="h-full bg-yellow-300 border-r-[2px] border-[#0a0a0a]"
                        style={{ width: `${revPct}%` }}
                      />
                    </div>
                    <div className="mt-1 h-3 border-[2px] border-[#0a0a0a] bg-[#FAF7EC]">
                      <div
                        className={`h-full border-r-[2px] border-[#0a0a0a] ${opLoss ? "bg-rose-300" : "bg-emerald-300"}`}
                        style={{ width: `${opPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="mt-2 font-mono text-[9px] text-[#0a0a0a]/45 uppercase tracking-wider">
                상단: 매출 (피크 100) · 하단: 영업이익 (절댓값, 적자=분홍)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: 뉴스 + 검색 트렌드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 뉴스 */}
        <div className="brutal bg-white p-5">
          <SectionHeader>최근 뉴스 ({p.news.length}건)</SectionHeader>
          {p.news.length === 0 ? (
            <p className="text-[12px] text-[#0a0a0a]/55">최근 3개월 뉴스 없음</p>
          ) : (
            <div className="space-y-4">
              {newsCats.map(([cat, articles]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-block border-[2px] border-[#0a0a0a] ${NEWS_COLOR[cat]} px-2 py-0.5 text-[10px] font-extrabold`}>
                      {cat}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#0a0a0a]/55">
                      {articles.length}건
                    </span>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {articles.slice(0, 4).map((n, i) => (
                      <li key={n.link + i} className="text-[12px] leading-snug">
                        <a
                          href={n.originallink || n.link}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-[#0a0a0a] hover:bg-yellow-300"
                          dangerouslySetInnerHTML={{
                            __html: n.title.replace(/<b>|<\/b>/g, ""),
                          }}
                        />
                        <span className="ml-1.5">
                          <ReliabilityBadge r={n.reliability} />
                        </span>
                      </li>
                    ))}
                    {articles.length > 4 && (
                      <li className="text-[10px] font-mono text-[#0a0a0a]/45">
                        ...외 {articles.length - 4}건
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 검색 트렌드 */}
        <div className="brutal bg-white p-5">
          <SectionHeader>검색량 트렌드 (12개월)</SectionHeader>
          {!p.trend ? (
            <p className="text-[12px] text-[#0a0a0a]/55">
              네이버 데이터랩 데이터 없음 (검색량 미미 또는 권한 미부여)
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`inline-block border-[2px] border-[#0a0a0a] px-2 py-1 text-[11px] font-extrabold ${
                  p.trend.momentum === "rising" ? "bg-emerald-300"
                  : p.trend.momentum === "declining" ? "bg-rose-300"
                  : "bg-amber-300"
                }`}>
                  {p.trend.momentum === "rising" ? "↑ Rising"
                    : p.trend.momentum === "declining" ? "↓ Declining"
                    : "→ Stable"}
                  {" · "}
                  {p.trend.momentumPct > 0 ? "+" : ""}{p.trend.momentumPct}%
                </span>
                <span className="font-mono text-[10px] text-[#0a0a0a]/55">
                  피크 {p.trend.peakMonth}
                </span>
              </div>
              <div className="flex items-end gap-1 h-24 border-b-[2px] border-[#0a0a0a]">
                {p.trend.monthly.map((m) => {
                  const h = (m.ratio / trendMax) * 100;
                  return (
                    <div
                      key={m.month}
                      className="flex-1 border-[1.5px] border-[#0a0a0a] bg-cyan-400"
                      style={{ height: `${Math.max(h, 2)}%` }}
                      title={`${m.month}: ${m.ratio.toFixed(0)}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between font-mono text-[9px] text-[#0a0a0a]/50">
                <span>{p.trend.monthly[0]?.month ?? ""}</span>
                <span>{p.trend.monthly[p.trend.monthly.length - 1]?.month ?? ""}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: 공시 */}
      {p.disclosures.length > 0 && (
        <div className="brutal bg-white p-5">
          <SectionHeader>최근 공시 ({p.disclosures.length}건)</SectionHeader>
          <ul className="space-y-1">
            {p.disclosures.slice(0, 10).map((d) => (
              <li
                key={d.rceptNo}
                className="flex items-baseline gap-3 text-[12px] py-1.5 border-b border-[#0a0a0a]/10 last:border-b-0"
              >
                <span className="font-mono text-[10px] font-bold text-[#0a0a0a]/55 shrink-0 w-[80px]">
                  {fmtKoreanDate(d.rceptDt)}
                </span>
                <a
                  href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rceptNo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#0a0a0a] hover:bg-yellow-300 truncate"
                >
                  {d.rceptNm}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[10px] font-mono text-[#0a0a0a]/45">
        수집 시각 {new Date(p.fetchedAt).toLocaleString("ko-KR")} · row id {row.id.slice(0, 8)}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  multiline = false,
}: {
  label: string;
  children: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className={`flex ${multiline ? "flex-col gap-0.5" : "items-baseline gap-3"}`}>
      <dt className="shrink-0 w-[70px] text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/55">
        {label}
      </dt>
      <dd className="font-mono font-bold text-[#0a0a0a] break-words">{children}</dd>
    </div>
  );
}
