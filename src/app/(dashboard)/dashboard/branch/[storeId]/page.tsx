import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import { getStoreById } from "@/lib/stores";
import { fetchCommercialTrade, formatPrice10k } from "@/lib/realEstate";
import { getTradeArea, getCohortStat } from "@/lib/tradeArea";
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
import {
  findNearestHotspot,
  fetchCongestionByAreaName,
  CONGEST_BG,
} from "@/lib/congestion/seoul";
import {
  getResidents,
  RESIDENTS_BASE_YM,
  AGE_GROUP_LABELS,
  pctOf,
} from "@/lib/population/residents";
import { getCategoryGap, type RetailCategory } from "@/lib/branch/categoryGap";
import { getAttractionRows } from "@/lib/attraction/queries";
import KakaoStoreMap from "@/components/maps/KakaoStoreMap";

// 컨텐츠 유치 카테고리(attraction) → 리테일 매출 카테고리 매핑.
// 두 분류 체계가 달라 대응되는 것만 연결 → 나머지 빈 카테고리는 피어 갭으로 커버.
const ATTRACTION_TO_RETAIL: Record<string, RetailCategory> = {
  "스포츠": "스포츠",
  "리빙": "라이프스타일",
  "팬시/굿즈": "잡화",
  "키즈카페": "아동의류",
};

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

  // 행정동 거주인구 (행안부 주민등록, 시군구 합산 + 점포 행정동)
  const residents = getResidents(storeId);

  // 카테고리 갭(상권유형 대비) + 제안 브랜드(피어 갭). 빈 카테고리에 맞는 유치검토 브랜드도 매핑.
  const categoryGap = getCategoryGap(storeId, store.name);
  const attractionByWeakCat = new Map<RetailCategory, string[]>();
  if (categoryGap && categoryGap.weak.length > 0) {
    const weakCats = new Set(categoryGap.weak.map((w) => w.cat));
    const rows = await getAttractionRows();
    for (const r of rows) {
      if (r.is_completed || !r.category) continue;
      const mapped = ATTRACTION_TO_RETAIL[r.category.trim()];
      if (!mapped || !weakCats.has(mapped)) continue;
      const list = attractionByWeakCat.get(mapped) ?? [];
      if (!list.includes(r.brand_name)) list.push(r.brand_name);
      attractionByWeakCat.set(mapped, list);
    }
  }

  // 서울 핫스팟 매칭 + 실시간 혼잡도
  const hotspotMatch = findNearestHotspot({ lat: store.lat, lng: store.lng }, 5000);
  const congestion = hotspotMatch
    ? await fetchCongestionByAreaName(hotspotMatch.hotspot.name)
    : null;

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

          {/* 실시간 혼잡도 — 서울 핫스팟 매칭 (서울 점포만) */}
          {congestion && hotspotMatch && (
            <Section
              title={`실시간 혼잡도 (${congestion.areaName})`}
              className="lg:col-span-3"
            >
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className={`inline-block border-[2px] border-[#0a0a0a] px-3 py-1 text-[13px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0_0_#0a0a0a] ${CONGEST_BG[congestion.congestLvl] ?? "bg-[#F1ECDB] text-[#0a0a0a]"}`}>
                  {congestion.congestLvl}
                </span>
                <span className="inline-block border-[1.5px] border-[#0a0a0a] bg-[#F1ECDB] px-2 py-0 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]">
                  {hotspotMatch.hotspot.name} · {Math.round(hotspotMatch.distanceM)}m
                </span>
                <span className="font-mono text-[10px] font-bold tabular-nums text-[#0a0a0a]/55">
                  업데이트 {congestion.ppltnTime}
                </span>
              </div>

              <p className="mb-4 text-[12px] font-medium text-[#0a0a0a]/75 leading-relaxed">
                {congestion.congestMsg}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label="현재 인구 (예상)"
                  value={`${congestion.ppltnMin.toLocaleString()}~${congestion.ppltnMax.toLocaleString()}`}
                />
                <Stat
                  label="남 / 여"
                  value={`${congestion.maleRate}% / ${congestion.femaleRate}%`}
                />
                <Stat
                  label="상주 / 방문"
                  value={`${congestion.residentRate}% / ${congestion.nonResidentRate}%`}
                />
                <Stat
                  label="피크 연령"
                  value={(() => {
                    const ages = Object.entries(congestion.ageRate);
                    const top = ages.reduce((a, b) => (b[1] > a[1] ? b : a));
                    const label = top[0].replace("_over", "+").replace("_", "~");
                    return `${label}세 (${top[1]}%)`;
                  })()}
                />
              </div>

              {/* 연령 분포 */}
              <div className="mt-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65 mb-2">
                  연령 분포
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {[
                    ["0_9",   "0~9"],
                    ["10_19", "10대"],
                    ["20_29", "20대"],
                    ["30_39", "30대"],
                    ["40_49", "40대"],
                    ["50_59", "50대"],
                    ["60_69", "60대"],
                    ["70_over", "70+"],
                  ].map(([key, label]) => {
                    const rate = congestion.ageRate[key as keyof typeof congestion.ageRate];
                    return (
                      <div key={key} className="border-[2px] border-[#0a0a0a] bg-white px-2 py-2 shadow-[2px_2px_0_0_#0a0a0a]">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">{label}</p>
                        <p className="mt-0.5 font-mono text-[15px] font-extrabold tabular-nums text-[#0a0a0a]">
                          {rate}<span className="text-[10px] font-sans text-[#0a0a0a]/50">%</span>
                        </p>
                        <div className="mt-1 h-1.5 border-[1px] border-[#0a0a0a] bg-white overflow-hidden">
                          <div className="h-full bg-violet-500" style={{ width: `${Math.min(rate * 5, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 12시간 예측 */}
              {congestion.forecasts.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65 mb-2">
                    12시간 예측
                  </p>
                  <div className="overflow-x-auto -mx-1 px-1">
                    <div className="flex gap-1.5 min-w-max">
                      {congestion.forecasts.slice(0, 12).map((f, i) => {
                        const hour = f.fcstTime.slice(11, 16); // HH:mm
                        const cls = CONGEST_BG[f.fcstCongestLvl] ?? "bg-[#F1ECDB] text-[#0a0a0a]";
                        return (
                          <div key={i} className="flex-shrink-0 w-[68px] border-[2px] border-[#0a0a0a] bg-white shadow-[2px_2px_0_0_#0a0a0a]">
                            <div className={`px-2 py-1 border-b-[1.5px] border-[#0a0a0a] text-[9.5px] font-extrabold uppercase tracking-wider text-center ${cls}`}>
                              {f.fcstCongestLvl}
                            </div>
                            <div className="px-2 py-1.5 text-center">
                              <p className="font-mono text-[10px] font-extrabold tabular-nums text-[#0a0a0a]">{hour}</p>
                              <p className="font-mono text-[9px] tabular-nums text-[#0a0a0a]/55 mt-0.5">
                                {Math.round((f.fcstPpltnMin + f.fcstPpltnMax) / 2 / 1000)}k
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55 leading-relaxed">
                ※ 출처: 서울 열린데이터광장 · 실시간 도시데이터 · 5분 갱신 ·
                현재 점포에서 가장 가까운 핫스팟 권역 데이터입니다.
              </p>
            </Section>
          )}

          {/* 행정동 거주인구 · 연령/성별 (행안부 주민등록) */}
          {residents && (
            <Section
              title={`거주인구 · 연령/성별 (${RESIDENTS_BASE_YM.slice(0, 7)})`}
              className="lg:col-span-3"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label={`${residents.sigungu.name} 총인구`}
                  value={`${residents.sigungu.total.toLocaleString()}명`}
                />
                <Stat
                  label="남 / 여"
                  value={`${Math.round(pctOf(residents.sigungu.male, residents.sigungu.total))}% / ${Math.round(pctOf(residents.sigungu.female, residents.sigungu.total))}%`}
                />
                <Stat
                  label="핵심 30~50대"
                  value={`${Math.round(
                    pctOf(
                      residents.sigungu.ageGroups["30_39"] +
                        residents.sigungu.ageGroups["40_49"] +
                        residents.sigungu.ageGroups["50_59"],
                      residents.sigungu.total,
                    ),
                  )}%`}
                />
                {residents.dong ? (
                  <Stat
                    label={`${residents.dong.name} (행정동)`}
                    value={`${residents.dong.total.toLocaleString()}명`}
                  />
                ) : (
                  <Stat label="점포 행정동" value="매칭 없음" />
                )}
              </div>

              {/* 연령 분포 (시군구 합산, 비중 %) */}
              <div className="mt-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65 mb-2">
                  연령 분포 · {residents.sigungu.name}
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {AGE_GROUP_LABELS.map(([key, label]) => {
                    const rate = pctOf(residents.sigungu.ageGroups[key], residents.sigungu.total);
                    return (
                      <div key={key} className="border-[2px] border-[#0a0a0a] bg-white px-2 py-2 shadow-[2px_2px_0_0_#0a0a0a]">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">{label}</p>
                        <p className="mt-0.5 font-mono text-[15px] font-extrabold tabular-nums text-[#0a0a0a]">
                          {rate.toFixed(0)}<span className="text-[10px] font-sans text-[#0a0a0a]/50">%</span>
                        </p>
                        <div className="mt-1 h-1.5 border-[1px] border-[#0a0a0a] bg-white overflow-hidden">
                          <div className="h-full bg-violet-500" style={{ width: `${Math.min(rate * 5, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-4 text-[10px] font-medium text-[#0a0a0a]/55">
                행정안전부 주민등록 인구 · {RESIDENTS_BASE_YM} 기준 · {residents.sigungu.name} {residents.sigungu.dongCount}개 행정동 합산
                {residents.dong ? "" : " · 점포 행정동은 법정동↔행정동 명 상이로 미매칭(시군구 기준)"}
              </p>
            </Section>
          )}

          {/* 카테고리 갭 & 제안 브랜드 — 상권유형(cohort) 대비 */}
          {categoryGap && (categoryGap.weak.length > 0 || categoryGap.peerGap.length > 0) && (
            <Section
              title={`카테고리 갭 & 제안 (${categoryGap.tradeAreaType} ${categoryGap.cohortSize}곳)`}
              className="lg:col-span-3"
            >
              {/* 빈 카테고리 */}
              {categoryGap.weak.length > 0 ? (
                <div className="mb-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65 mb-2">
                    빈 카테고리 · 상권유형 평균 대비
                  </p>
                  <div className="space-y-2.5">
                    {categoryGap.weak.map((w) => {
                      const cands = attractionByWeakCat.get(w.cat) ?? [];
                      return (
                        <div key={w.cat} className="border-[2px] border-[#0a0a0a] bg-white px-3 py-2.5 shadow-[2px_2px_0_0_#0a0a0a]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-extrabold text-[#0a0a0a]">{w.cat}</span>
                            <span className="font-mono text-[11px] font-bold text-[#0a0a0a]/70">
                              {store.name} {w.myPct}% <span className="text-[#0a0a0a]/40">vs</span> 유형평균 {w.cohortAvg}%
                              <span className="ml-1.5 text-rose-700 font-extrabold">▼{w.gap}%p</span>
                            </span>
                          </div>
                          {/* 이 점포 vs 유형평균 막대 */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-12 shrink-0 text-[9px] font-bold text-[#0a0a0a]/50">이 점포</span>
                              <div className="h-2 flex-1 border-[1px] border-[#0a0a0a] bg-white overflow-hidden">
                                <div className="h-full bg-rose-400" style={{ width: `${Math.min(w.myPct * 5, 100)}%` }} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-12 shrink-0 text-[9px] font-bold text-[#0a0a0a]/50">유형평균</span>
                              <div className="h-2 flex-1 border-[1px] border-[#0a0a0a] bg-white overflow-hidden">
                                <div className="h-full bg-violet-500" style={{ width: `${Math.min(w.cohortAvg * 5, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                          {cands.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="border-[1.5px] border-[#0a0a0a] bg-yellow-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">유치검토</span>
                              {cands.slice(0, 6).map((b) => (
                                <span key={b} className="text-[11px] font-bold text-[#0a0a0a]">{b}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mb-5 text-[12px] font-bold text-[#0a0a0a]/55">
                  상권유형 평균 대비 유의하게 빈 카테고리 없음 (균형).
                </p>
              )}

              {/* 제안 브랜드 — 피어 갭 */}
              {categoryGap.peerGap.length > 0 && (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65 mb-2">
                    제안 브랜드 · 같은 유형엔 있는데 {store.name}엔 없는
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryGap.peerGap.map((b) => (
                      <div key={b.brand} className="flex items-center justify-between gap-2 border-[2px] border-[#0a0a0a] bg-white px-3 py-2 shadow-[2px_2px_0_0_#0a0a0a]">
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="border-[1.5px] border-[#0a0a0a] bg-cyan-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shrink-0">피어갭</span>
                          <span className="truncate text-[12.5px] font-bold text-[#0a0a0a]">{b.brand}</span>
                        </div>
                        <span className="shrink-0 font-mono text-[10.5px] font-bold text-[#0a0a0a]/65">
                          {b.peerCount}곳 · 평균 {(b.avgSales / 1e8).toFixed(1)}억
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-4 text-[10px] font-medium text-[#0a0a0a]/55">
                ERP 점포×카테고리·브랜드 매출(2026-04) 기준 · 빈 카테고리 = 상권유형 평균의 70% 미만 또는 gap 3%p↑ · 피어 갭 = 같은 유형 2곳 이상 입점·고매출 중 미입점
              </p>
            </Section>
          )}

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
