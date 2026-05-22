"use client";

import { useState } from "react";
import type { BrandKeywordResult } from "@/app/api/brand-keyword/route";

// Neo-Brutalist 칩 색상 로테이션 (paper 톤에 맞는 형광)
const CHIP_STYLES = [
  "bg-yellow-300 text-[#0a0a0a]",
  "bg-cyan-400 text-[#0a0a0a]",
  "bg-violet-300 text-[#0a0a0a]",
  "bg-rose-300 text-[#0a0a0a]",
  "bg-emerald-300 text-[#0a0a0a]",
  "bg-amber-300 text-[#0a0a0a]",
];

function formatPrice(won: number | null): string {
  if (won === null) return "—";
  if (won >= 100_000_000) return (won / 100_000_000).toFixed(1) + "억원";
  if (won >= 10_000) return (won / 10_000).toFixed(1) + "만원";
  if (won >= 1_000) return (won / 1_000).toFixed(1) + "천원";
  return won.toLocaleString() + "원";
}

interface KpiBoxProps {
  label: string;
  value: string;
  accent?: "default" | "highlight";
}
function KpiBox({ label, value, accent = "default" }: KpiBoxProps) {
  return (
    <div className={`brutal p-5 ${accent === "highlight" ? "bg-yellow-300" : "bg-white"}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55 mb-2">
        {label}
      </p>
      <p className="font-mono text-[28px] sm:text-[32px] font-extrabold tabular-nums leading-none text-[#0a0a0a]">
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
      {children}
    </p>
  );
}

export default function BrandKeywordClient() {
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BrandKeywordResult | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  async function handleAnalyze(e?: React.FormEvent) {
    e?.preventDefault();
    if (!brand.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/brand-keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: brand.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "분석 실패");
      } else {
        setData(json as BrandKeywordResult);
        setRecent((prev) => [brand.trim(), ...prev.filter((b) => b !== brand.trim())].slice(0, 6));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  function pickRecent(b: string) {
    setBrand(b);
    setTimeout(() => handleAnalyze(), 0);
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 bg-[#FAF7EC]">
      <div className="max-w-[1480px] mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="font-display text-[42px] sm:text-[52px] leading-[1] text-[#0a0a0a]">
            브랜드 키워드 분석
          </h1>
          <p className="mt-1 text-[13px] text-[#0a0a0a]/70">
            네이버 쇼핑 기반 가격대 · 연관 키워드 · 카테고리 분포 (최대 300건 샘플)
          </p>
        </div>

        {/* 검색 폼 */}
        <form onSubmit={handleAnalyze} className="brutal bg-white p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/55">
                브랜드명
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="예: 하이마트, 무신사, 다이소..."
                className="w-full border-[2px] border-[#0a0a0a] bg-[#FAF7EC] px-4 py-3 font-mono text-[15px] font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                disabled={loading}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !brand.trim()}
              className="shrink-0 border-[2px] border-[#0a0a0a] bg-yellow-300 px-8 py-3 text-[13px] font-extrabold shadow-[3px_3px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "분석 중..." : "분석하기"}
            </button>
          </div>
          {recent.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/40 pt-1">최근</span>
              {recent.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => pickRecent(b)}
                  className="text-[11px] font-bold border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] px-2.5 py-1 hover:bg-[#FAF7EC] transition-colors"
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* 오류 */}
        {error && (
          <div className="brutal-sm mb-6 border-rose-500 bg-rose-50 p-4">
            <p className="font-bold text-rose-700">{error}</p>
          </div>
        )}

        {/* KPI 5칸 */}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <KpiBox label="검색결과" value={data.total.toLocaleString()} />
              <KpiBox label="최저가" value={formatPrice(data.priceStats.min)} accent="highlight" />
              <KpiBox label="평균가" value={formatPrice(data.priceStats.avg)} />
              <KpiBox label="최고가" value={formatPrice(data.priceStats.max)} />
              <KpiBox label="판매처" value={data.uniqueSellers.toString()} />
            </div>

            {/* 연관 키워드 + 카테고리 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* 연관 키워드 */}
              <div className="brutal bg-white p-5">
                <SectionHeader>연관 키워드 TOP 20</SectionHeader>
                {data.relatedKeywords.length === 0 ? (
                  <p className="text-[12px] text-slate-400">키워드 추출 결과 없음</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.relatedKeywords.map((kw, i) => {
                      const cls = CHIP_STYLES[i % CHIP_STYLES.length];
                      return (
                        <span
                          key={kw.keyword + i}
                          className={`inline-flex items-baseline gap-1.5 border-[2px] border-[#0a0a0a] ${cls} px-2.5 py-1 text-[12px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a]`}
                        >
                          <span>{kw.keyword}</span>
                          <span className="font-mono text-[10px] opacity-70 font-bold">{kw.count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 카테고리 분포 */}
              <div className="brutal bg-white p-5">
                <SectionHeader>카테고리 분포</SectionHeader>
                {data.categories.length === 0 ? (
                  <p className="text-[12px] text-slate-400">카테고리 데이터 없음</p>
                ) : (
                  <div className="space-y-3">
                    {data.categories.map((c, idx) => {
                      const barColors = ["bg-yellow-300", "bg-cyan-400", "bg-violet-300", "bg-rose-300", "bg-emerald-300", "bg-amber-300"];
                      const bar = barColors[idx % barColors.length];
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between text-[12px] mb-1.5">
                            <span className="font-bold text-[#0a0a0a]">{c.name}</span>
                            <span className="font-mono font-extrabold text-[#0a0a0a]">{c.pct}%</span>
                          </div>
                          <div className="h-5 border-[2px] border-[#0a0a0a] bg-[#FAF7EC]">
                            <div
                              className={`h-full ${bar} border-r-[2px] border-[#0a0a0a] transition-all duration-500`}
                              style={{ width: `${c.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top 판매처 + 브랜드 분포 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top 판매처 */}
              {data.topSellers.length > 0 && (
                <div className="brutal bg-white p-5">
                  <SectionHeader>
                    상위 판매처 ({data.uniqueSellers}개 중 Top {Math.min(10, data.topSellers.length)})
                  </SectionHeader>
                  <ul className="space-y-1">
                    {data.topSellers.map((s, i) => (
                      <li
                        key={s.name}
                        className="flex items-center justify-between text-[13px] py-1.5 border-b border-[#0a0a0a]/10 last:border-b-0"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="font-mono font-extrabold text-[#0a0a0a]/40 w-6 text-right">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-bold text-[#0a0a0a]">{s.name}</span>
                        </span>
                        <span className="font-mono text-[12px] font-bold text-[#0a0a0a]/60">
                          {s.count}건
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 함께 노출되는 브랜드 */}
              {data.topBrands.length > 0 && (
                <div className="brutal bg-white p-5">
                  <SectionHeader>함께 노출되는 브랜드</SectionHeader>
                  <div className="flex flex-wrap gap-2">
                    {data.topBrands.map((b) => (
                      <span
                        key={b.name}
                        className="inline-flex items-baseline gap-1.5 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] px-2.5 py-1 text-[12px] font-bold"
                      >
                        <span>{b.name}</span>
                        <span className="font-mono text-[10px] opacity-60">{b.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-[10px] text-[#0a0a0a]/45 font-mono">
              분석 샘플 {data.fetched}건 (네이버 쇼핑, 정확도순) · 검색결과 총 {data.total.toLocaleString()}건
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div className="brutal-sm bg-[#F1ECDB]/50 p-12 text-center">
            <p className="font-display text-[20px] text-[#0a0a0a]">브랜드명을 입력해 시작하세요</p>
            <p className="mt-1 text-[12px] text-[#0a0a0a]/55">
              네이버 쇼핑에서 최대 300건 상품 수집 → 자동 집계 (Claude 호출 없음, 비용 0)
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
