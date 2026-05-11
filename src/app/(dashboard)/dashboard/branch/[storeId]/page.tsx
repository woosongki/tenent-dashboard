import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import { getStoreById, BRAND_BADGE } from "@/lib/stores";
import { fetchCommercialTrade, formatPrice10k } from "@/lib/realEstate";
import { getTradeArea, getCohortStat, TRADE_AREA_BADGE } from "@/lib/tradeArea";
import {
  getCommercialRent,
  getRentSource,
  formatWon,
  estimateMonthlyByPyeong,
} from "@/lib/commercialRent";
import {
  computeLocalRent,
  formatRent,
  formatPricePerM2,
  CAP_RATE_PERCENT,
} from "@/lib/localRent";
import KakaoStoreMap from "@/components/maps/KakaoStoreMap";

// 첫 방문 시 동적 렌더 (3개 월 외부 API 호출이라 빌드 시 prerender 비효율)
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeId: string }>;
}): Promise<Metadata> {
  const { storeId } = await params;
  const store = getStoreById(storeId);
  return {
    title: store ? `${store.brand} ${store.name} — 상권분석` : "상권분석",
  };
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { storeId } = await params;
  const store = getStoreById(storeId);
  if (!store) notFound();

  const trade = await fetchCommercialTrade(store.lawdCd, { months: 3 });
  const tradeArea = getTradeArea(store.id);
  const cohort = getCohortStat(store.id);
  const rent = getCommercialRent(store.lawdCd);
  const rentSource = getRentSource();
  // 1km 인근 (동일 행정동 우선) 추정 임대료
  const localRent = computeLocalRent({
    trades: trade.items,
    storeRegion3: store.region3,
    storeRegion2: store.region2,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[
          { label: "대시보드", href: "/dashboard" },
          { label: "상권분석", href: "/dashboard/branch" },
          { label: `${store.brand} ${store.name}` },
        ]}
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-block border-[1.5px] border-[#0a0a0a] bg-[#0a0a0a] text-white px-2 py-0 text-[10px] font-extrabold uppercase tracking-wider`}>
              {store.brand}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">{store.type}</span>
            {store.hasKimsclub && (
              <span className="inline-block border-[1.5px] border-[#0a0a0a] bg-yellow-300 px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">
                킴스클럽 입점
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-[22px] font-extrabold tracking-tight text-slate-900">
            {store.name}
          </h1>
          <p className="mt-1 text-[13px] font-medium text-[#0a0a0a]/65">
            {store.address}
            {store.phone && <span className="ml-3 font-mono text-[#0a0a0a]/55">· {store.phone}</span>}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 위치 + 좌표/코드 */}
          <Section title="위치" className="lg:col-span-2">
            <KakaoStoreMap
              lat={store.lat}
              lng={store.lng}
              label={`${store.brand} ${store.name}`}
              radius={tradeArea?.radius ?? 500}
              height="320px"
            />
            <KV
              rows={[
                ["도로명", store.roadAddress ?? "-"],
                ["지번", store.jibunAddress ?? "-"],
                ["행정구역", `${store.region1} ${store.region2} ${store.region3 ?? ""}`],
              ]}
            />
          </Section>

          {/* 상권 분석 */}
          <Section title={`주변 상권 (반경 ${tradeArea?.radius ?? 500}m)`}>
            {tradeArea ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`inline-block border-[1.5px] border-[#0a0a0a] bg-violet-300 px-2 py-0 text-[11px] font-extrabold uppercase tracking-wider text-violet-950`}
                  >
                    {tradeArea.tradeAreaType}
                  </span>
                  <span className="font-mono text-[11px] font-extrabold tabular-nums text-[#0a0a0a]">
                    총 {tradeArea.total.toLocaleString()}개 점포
                  </span>
                </div>

                <div className="space-y-2">
                  <Bar label="음식"      pct={tradeArea.breakdown.food.pct}       count={tradeArea.breakdown.food.count}       color="bg-orange-400" />
                  <Bar label="소매"      pct={tradeArea.breakdown.retail.pct}     count={tradeArea.breakdown.retail.count}     color="bg-blue-400" />
                  <Bar label="생활서비스" pct={tradeArea.breakdown.lifeService.pct} count={tradeArea.breakdown.lifeService.count} color="bg-emerald-400" />
                  <Bar label="의료"      pct={tradeArea.breakdown.medical.pct}    count={tradeArea.breakdown.medical.count}    color="bg-pink-400" />
                  <Bar label="학문/교육" pct={tradeArea.breakdown.education.pct}  count={tradeArea.breakdown.education.count}  color="bg-violet-400" />
                  <Bar label="관광/여가" pct={tradeArea.breakdown.leisure.pct}    count={tradeArea.breakdown.leisure.count}    color="bg-teal-400" />
                </div>

                {tradeArea.competitorCount > 0 && (
                  <div className="mt-4 border-[2px] border-[#0a0a0a] bg-rose-100 px-3 py-2 text-[12px] shadow-[3px_3px_0_0_#0a0a0a]">
                    <span className="font-extrabold uppercase tracking-wider text-rose-700">⚠ 경쟁점 {tradeArea.competitorCount}개</span>
                    <p className="text-[10px] font-medium text-rose-700 mt-0.5">반경 내 백화점·아울렛·대형마트·복합쇼핑센터</p>
                  </div>
                )}

                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
                  출처: 소상공인시장진흥공단 상가업소 OpenAPI · 수집{" "}
                  {new Date(tradeArea.fetchedAt).toLocaleDateString("ko-KR")}
                </p>
              </>
            ) : (
              <div className="border-[2px] border-[#0a0a0a] bg-[#F1ECDB] p-3 text-[12px]">
                <p className="font-extrabold uppercase tracking-wider text-[#0a0a0a]">상권 데이터 수집 전</p>
                <p className="mt-1 text-[11px] font-medium text-[#0a0a0a]/70 leading-relaxed">
                  <code className="px-1 py-0.5 rounded bg-slate-200 text-[10px]">node scripts/fetch-trade-area.mjs --only {store.id}</code>{" "}
                  실행 후 새로고침
                </p>
              </div>
            )}
          </Section>

          {/* 1차상권(동일 행정동) 추정 임대료 — 매매 실거래가 환산 */}
          {localRent.sampleCount > 0 && (
            <Section
              title={`1차상권 추정 임대료 (${localRent.scope === "동" ? "동일 행정동" : "시군구 평균"})`}
              className="lg:col-span-3"
            >
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="inline-block border-[1.5px] border-[#0a0a0a] bg-yellow-300 px-2 py-0 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">
                  {localRent.scopeLabel}
                </span>
                <span className="inline-block border-[1.5px] border-[#0a0a0a] bg-[#F1ECDB] px-2 py-0 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">
                  표본 {localRent.sampleCount}건
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
                  자본환원율 {CAP_RATE_PERCENT}% 가정 · 추정값
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label="중위 매매가/㎡"
                  value={formatPricePerM2(localRent.medianPricePerM2_10k)}
                />
                <Stat
                  label="추정 월임대료/㎡"
                  value={localRent.estimatedMonthlyRentPerM2 > 0
                    ? `${localRent.estimatedMonthlyRentPerM2.toLocaleString()}원`
                    : "-"}
                />
                {localRent.estimatedMonthlyRentByPyeong.slice(0, 2).map((p) => (
                  <Stat
                    key={p.pyeong}
                    label={`${p.pyeong}평 월세 추정`}
                    value={formatRent(p.monthlyRent)}
                  />
                ))}
              </div>

              {localRent.estimatedMonthlyRentByPyeong.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {localRent.estimatedMonthlyRentByPyeong.map((p) => (
                    <div
                      key={p.pyeong}
                      className="border-[2px] border-[#0a0a0a] bg-white px-4 py-3 shadow-[3px_3px_0_0_#0a0a0a]"
                    >
                      <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65">
                        {p.pyeong}평 ({Math.round(p.areaM2)}㎡)
                      </p>
                      <p className="mt-1.5 font-mono text-[18px] font-extrabold tabular-nums text-[#0a0a0a]">
                        {formatRent(p.monthlyRent)}
                        <span className="ml-1 text-[10px] font-bold text-[#0a0a0a]/50 font-sans">/월</span>
                      </p>
                      <p className="font-mono text-[10px] font-bold tabular-nums text-[#0a0a0a]/55">
                        연 {formatRent(p.monthlyRent * 12)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55 leading-relaxed">
                ※ 국토부 상업용 매매 실거래가를 자본환원율(연 {CAP_RATE_PERCENT}%)로 환산한 추정치입니다.
                실제 시장 임대료와 차이가 있을 수 있으며, 매매 거래가 있는 매물 기준 통계입니다.
              </p>
            </Section>
          )}

          {/* 권역 평균 임대료 (한국부동산원) */}
          <Section
            title={`권역 평균 상가 임대료 (${rentSource.period})`}
            className="lg:col-span-3"
          >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="inline-block border-[1.5px] border-[#0a0a0a] bg-[#F1ECDB] px-2 py-0 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">
                {rent.scope}
              </span>
              {rent.level !== "lawd" && (
                <span className="text-[10px] text-slate-400">
                  ※ {rent.level === "siDo" ? "시도 평균 적용" : "전국 평균 적용 (권역 데이터 미수록)"}
                </span>
              )}
              {rent.note && (
                <span className="text-[10px] text-slate-500">· {rent.note}</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="㎡당 월 임대료"
                value={`${rent.smallRetail_rent.toLocaleString()}원`}
              />
              <Stat
                label="10평 환산 월세"
                value={formatWon(estimateMonthlyByPyeong(rent.smallRetail_rent, 10))}
              />
              <Stat
                label="20평 환산 월세"
                value={formatWon(estimateMonthlyByPyeong(rent.smallRetail_rent, 20))}
              />
              <Stat
                label="33평 환산 월세"
                value={formatWon(estimateMonthlyByPyeong(rent.smallRetail_rent, 33))}
              />
            </div>

            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55 leading-relaxed">
              출처:{" "}
              <a
                href={rentSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#0a0a0a] font-bold"
              >
                {rentSource.publisher} {rentSource.report}
              </a>{" "}
              ({rentSource.period}) · 소규모 상가 기준 · 단지/입지별 실제 시세와 다를 수 있음
            </p>
          </Section>

          {/* 같은 상권 유형 매장 비교 */}
          {cohort && tradeArea ? (
            <Section
              title={`같은 '${tradeArea.tradeAreaType}' 매장 ${cohort.cohortSize}곳 비교`}
              className="lg:col-span-3"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <CompareStat
                  label="점포 밀도"
                  myValue={`${tradeArea.total.toLocaleString()}`}
                  cohortValue={`${cohort.avgTotal.toLocaleString()}`}
                  unit="개"
                  delta={tradeArea.total - cohort.avgTotal}
                />
                <CompareStat
                  label="음식 비중"
                  myValue={`${tradeArea.breakdown.food.pct}`}
                  cohortValue={`${cohort.avgFoodPct}`}
                  unit="%"
                  delta={tradeArea.breakdown.food.pct - cohort.avgFoodPct}
                />
                <CompareStat
                  label="소매 비중"
                  myValue={`${tradeArea.breakdown.retail.pct}`}
                  cohortValue={`${cohort.avgRetailPct}`}
                  unit="%"
                  delta={tradeArea.breakdown.retail.pct - cohort.avgRetailPct}
                />
                <CompareStat
                  label="경쟁점"
                  myValue={`${tradeArea.competitorCount}`}
                  cohortValue={`${cohort.avgCompetitor}`}
                  unit="개"
                  delta={tradeArea.competitorCount - cohort.avgCompetitor}
                  inverse
                />
              </div>

              <div className="border-[2px] border-[#0a0a0a] bg-[#F1ECDB] px-4 py-3 mb-4 shadow-[3px_3px_0_0_#0a0a0a]">
                <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] mb-2">
                  점포 밀도 백분위 <span className="font-mono text-[#0a0a0a]/65">(cohort 내)</span>
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 border-[1.5px] border-[#0a0a0a] bg-white overflow-hidden">
                    <div
                      className="h-full bg-[#0a0a0a] transition-all"
                      style={{ width: `${cohort.totalPercentile}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-slate-900 w-12 text-right">
                    {cohort.totalPercentile}%
                  </span>
                </div>
                <p className="text-[10px] font-medium text-[#0a0a0a]/55 mt-1.5">
                  cohort {cohort.cohortSize}개 매장 중 점포 수 기준 백분위 (0=최저, 100=최고)
                </p>
              </div>

              {cohort.peers.length > 0 && (
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] mb-2">
                    유사 점포 밀도 매장
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {cohort.peers.map((p) => (
                      <Link
                        key={p.id}
                        href={`/dashboard/branch/${p.id}`}
                        className="border-[2px] border-[#0a0a0a] bg-white px-3 py-2 hover:bg-yellow-300 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#0a0a0a] transition-all"
                      >
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/55">{p.brand}</p>
                        <p className="text-[12px] font-medium text-slate-900">{p.name}</p>
                        <p className="font-mono text-[10px] font-extrabold tabular-nums text-[#0a0a0a]/70 mt-1">
                          {p.total.toLocaleString()}개 · 경쟁점 {p.competitorCount}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          ) : (
            <Section title="같은 상권 유형 매장 비교" className="lg:col-span-3">
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
                cohort 비교 데이터 준비 중입니다.
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
                상권 데이터가 수집된 점포가 충분히 모이면 활성화됩니다.
              </p>
            </Section>
          )}

          {/* 상업용 매매 실거래가 */}
          <Section
            title={`상업용 부동산 매매 실거래가 (최근 3개월, ${store.region2})`}
            className="lg:col-span-3"
          >
            {trade.summary && trade.summary.sample_count > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <Stat label="거래 건수" value={`${trade.summary.sample_count}건`} />
                  <Stat label="중위가" value={formatPrice10k(trade.summary.median_price_10k)} />
                  <Stat label="최저가" value={formatPrice10k(trade.summary.min_price_10k)} />
                  <Stat label="최고가" value={formatPrice10k(trade.summary.max_price_10k)} />
                </div>

                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="min-w-[640px] w-full text-[13px]">
                    <thead className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a]">
                      <tr className="border-b border-[#0a0a0a]/10 bg-[#F1ECDB]">
                        <th className="text-left py-2 px-3 font-medium tracking-tight">건물명</th>
                        <th className="text-left py-2 px-3 font-medium tracking-tight">동</th>
                        <th className="text-right py-2 px-3 font-medium tracking-tight">면적</th>
                        <th className="text-right py-2 px-3 font-medium tracking-tight">층</th>
                        <th className="text-right py-2 px-3 font-medium tracking-tight">거래가</th>
                        <th className="text-right py-2 px-3 font-medium tracking-tight">거래일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trade.items.slice(0, 30).map((item, i) => (
                        <tr key={i} className="border-b border-[#0a0a0a]/10">
                          <td className="py-2 px-3 text-slate-900">{item.name || "-"}</td>
                          <td className="py-2 px-3 text-slate-500">{item.district}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-[#0a0a0a]">
                            {item.area_m2}㎡
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-[#0a0a0a]">
                            {item.floor}층
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">
                            {formatPrice10k(item.price_10k)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-[#0a0a0a]/65">
                            {item.deal_date}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {trade.items.length > 30 && (
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a]/55 text-center">
                    총 {trade.items.length}건 중 최근 30건 표시
                  </p>
                )}
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">
                  출처: 국토교통부 상업용 부동산 실거래가 신고 (k-skill-proxy 캐시)
                </p>
              </>
            ) : (
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#0a0a0a]/65">
                해당 기간 내 거래 신고 내역이 없습니다.
              </p>
            )}
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`brutal bg-white p-5 ${className}`}>
      <h2 className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a] mb-4 inline-block border-[2px] border-[#0a0a0a] bg-yellow-300 px-2 py-0.5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white px-4 py-3 shadow-[3px_3px_0_0_#0a0a0a]">
      <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65">{label}</p>
      <p className="mt-1.5 font-mono text-[20px] font-extrabold tabular-nums text-[#0a0a0a]">{value}</p>
    </div>
  );
}

function CompareStat({
  label,
  myValue,
  cohortValue,
  unit,
  delta,
  inverse = false,
}: {
  label: string;
  myValue: string;
  cohortValue: string;
  unit: string;
  delta: number;
  /** delta가 음수일 때 좋은 지표(예: 경쟁점 적을수록 유리) */
  inverse?: boolean;
}) {
  const isPositive = inverse ? delta < 0 : delta > 0;
  const isNegative = inverse ? delta > 0 : delta < 0;
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white px-4 py-3 shadow-[3px_3px_0_0_#0a0a0a]">
      <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65">{label}</p>
      <p className="mt-1.5 font-mono text-[20px] font-extrabold tabular-nums text-[#0a0a0a]">
        {myValue}
        <span className="text-[11px] font-bold text-[#0a0a0a]/50 ml-0.5 font-sans">{unit}</span>
      </p>
      <p className="mt-1 text-[10px] font-medium text-[#0a0a0a]/65">
        평균 {cohortValue}
        {unit}{" "}
        <span
          className={
            isPositive
              ? "text-emerald-700 font-extrabold"
              : isNegative
              ? "text-rose-700 font-extrabold"
              : "text-[#0a0a0a]/40 font-bold"
          }
        >
          ({sign}
          {Math.round(delta * 10) / 10})
        </span>
      </p>
    </div>
  );
}

function Bar({
  label,
  pct,
  count,
  color,
}: {
  label: string;
  pct: number;
  count: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] mb-0.5">
        <span className="font-extrabold uppercase tracking-wider text-[#0a0a0a]">{label}</span>
        <span className="text-slate-500 tabular-nums">
          {count.toLocaleString()} <span className="text-slate-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3">
          <dt className="w-20 shrink-0 text-slate-500">{k}</dt>
          <dd className="flex-1 font-mono text-slate-700 break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
