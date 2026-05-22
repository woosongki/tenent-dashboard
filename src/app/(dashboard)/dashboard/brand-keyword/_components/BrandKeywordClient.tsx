"use client";

import { useState } from "react";
import type { BrandKeywordResult } from "@/app/api/brand-keyword/route";

// 키워드 칩 색상 로테이션
const CHIP_COLORS = [
  { border: "border-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-300" },
  { border: "border-cyan-400", bg: "bg-cyan-400/10", text: "text-cyan-300" },
  { border: "border-yellow-400", bg: "bg-yellow-400/10", text: "text-yellow-300" },
  { border: "border-pink-400", bg: "bg-pink-400/10", text: "text-pink-300" },
  { border: "border-violet-400", bg: "bg-violet-400/10", text: "text-violet-300" },
  { border: "border-orange-400", bg: "bg-orange-400/10", text: "text-orange-300" },
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
  highlight?: boolean;
}
function KpiBox({ label, value, highlight }: KpiBoxProps) {
  return (
    <div className={`border border-zinc-800 bg-zinc-950/50 rounded-xl px-5 py-4 ${highlight ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}>
      <div className={`text-[24px] font-bold leading-tight ${highlight ? "text-emerald-400" : "text-white"}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{label}</div>
    </div>
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-1 bg-emerald-400"></div>
            <span className="text-[11px] font-bold text-zinc-500 tracking-[.2em] uppercase">키워드 분석</span>
          </div>
          <h1 className="text-[36px] font-extrabold leading-tight">
            네이버{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              브랜드 키워드 분석
            </span>
          </h1>
          <p className="mt-2 text-[14px] text-zinc-400">
            네이버 쇼핑 기반 브랜드 키워드 · 가격대 · 카테고리 분포를 분석합니다.
          </p>
        </div>

        {/* 검색 폼 */}
        <form onSubmit={handleAnalyze} className="border border-zinc-800 bg-zinc-950/50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-1 bg-emerald-400"></div>
            <span className="text-[12px] font-bold text-zinc-300">브랜드 검색</span>
          </div>
          <label className="block text-[11px] text-zinc-400 mb-2">브랜드명</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="예: 하이마트, 무신사, 다이소..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-[15px] font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900/80"
              disabled={loading}
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !brand.trim()}
              className="shrink-0 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-950 font-bold px-8 rounded-xl transition-colors"
            >
              {loading ? "분석 중..." : "분석하기"}
            </button>
          </div>
          {recent.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recent.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => pickRecent(b)}
                  className="text-[12px] bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 rounded-full px-3 py-1"
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* 오류 */}
        {error && (
          <div className="border border-rose-500/50 bg-rose-500/10 text-rose-300 rounded-xl p-4 mb-6 text-[13px]">
            {error}
          </div>
        )}

        {/* KPI 5칸 */}
        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <KpiBox label="검색결과" value={data.total.toLocaleString()} />
              <KpiBox label="최저가" value={formatPrice(data.priceStats.min)} highlight />
              <KpiBox label="평균가" value={formatPrice(data.priceStats.avg)} />
              <KpiBox label="최고가" value={formatPrice(data.priceStats.max)} />
              <KpiBox label="판매처" value={data.uniqueSellers.toString()} />
            </div>

            {/* 연관 키워드 + 카테고리 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 연관 키워드 */}
              <div className="border border-zinc-800 bg-zinc-950/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-1 bg-emerald-400"></div>
                  <span className="text-[12px] font-bold text-zinc-300">연관 키워드 TOP 20</span>
                </div>
                {data.relatedKeywords.length === 0 ? (
                  <p className="text-[12px] text-zinc-500">키워드 추출 결과 없음</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.relatedKeywords.map((kw, i) => {
                      const c = CHIP_COLORS[i % CHIP_COLORS.length];
                      return (
                        <span
                          key={kw.keyword + i}
                          className={`inline-flex items-baseline gap-1.5 border ${c.border} ${c.bg} ${c.text} rounded-full px-3 py-1.5 text-[13px] font-semibold`}
                        >
                          <span>{kw.keyword}</span>
                          <span className="text-[10px] opacity-70 font-normal">{kw.count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 카테고리 분포 */}
              <div className="border border-zinc-800 bg-zinc-950/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-1 bg-emerald-400"></div>
                  <span className="text-[12px] font-bold text-zinc-300">카테고리 분포</span>
                </div>
                {data.categories.length === 0 ? (
                  <p className="text-[12px] text-zinc-500">카테고리 데이터 없음</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.categories.map((c) => (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="text-zinc-300">{c.name}</span>
                          <span className="font-mono text-zinc-500">{c.pct}%</span>
                        </div>
                        <div className="h-2 bg-zinc-900 rounded overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top 판매처 + 브랜드 분포 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 판매처 */}
              {data.topSellers.length > 0 && (
                <div className="border border-zinc-800 bg-zinc-950/50 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-1 bg-emerald-400"></div>
                    <span className="text-[12px] font-bold text-zinc-300">상위 판매처 ({data.uniqueSellers}개 중 Top 10)</span>
                  </div>
                  <ul className="space-y-1.5">
                    {data.topSellers.map((s, i) => (
                      <li key={s.name} className="flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2">
                          <span className="text-zinc-600 font-mono w-5 text-right">{i + 1}.</span>
                          <span className="text-zinc-200">{s.name}</span>
                        </span>
                        <span className="text-emerald-400 font-mono text-[12px]">{s.count}건</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 브랜드 분포 */}
              {data.topBrands.length > 0 && (
                <div className="border border-zinc-800 bg-zinc-950/50 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-1 bg-emerald-400"></div>
                    <span className="text-[12px] font-bold text-zinc-300">함께 노출되는 브랜드</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.topBrands.map((b) => (
                      <span
                        key={b.name}
                        className="inline-flex items-baseline gap-1.5 border border-zinc-700 bg-zinc-800/40 text-zinc-300 rounded-full px-3 py-1 text-[12px]"
                      >
                        <span>{b.name}</span>
                        <span className="text-[10px] opacity-60 font-mono">{b.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-[10px] text-zinc-600 font-mono">
              분석 샘플 {data.fetched}건 (네이버 쇼핑 정렬: 정확도순) · 검색결과 총 {data.total.toLocaleString()}건
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
            <p className="text-[14px]">브랜드명을 입력하고 분석하기를 누르세요</p>
            <p className="text-[11px] mt-1">네이버 쇼핑에서 최대 300건의 상품을 가져와 분석합니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
