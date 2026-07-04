"use client";

import { useState } from "react";

interface SuggestedBrand { name: string; reason: string; }
interface CategorySuggestion { cat: string; brands: SuggestedBrand[]; }

// 빈 카테고리 AI(Claude) 외부 브랜드 제안 — 온디맨드 버튼.
// 리테일 지도(정적) 제안을 넘어, 지도에 없는 카테고리/브랜드까지 외부 시장에서 제안.
export default function AiBrandSuggest({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[] | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/branch/${storeId}/suggest`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "제안 실패");
        return;
      }
      setSuggestions(data.suggestions ?? []);
    } catch {
      setError("네트워크 오류 — 다시 시도하세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 border-t-[2px] border-dashed border-[#0a0a0a]/25 pt-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65">
          AI 제안 · 외부 시장 브랜드 (Claude)
        </p>
        <button
          onClick={run}
          disabled={loading}
          className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? "분석 중…" : suggestions ? "다시 제안" : "AI 제안 받기"}
        </button>
        {suggestions && !loading && (
          <span className="font-mono text-[10px] font-bold text-[#0a0a0a]/50">
            빈 카테고리를 채울 외부 브랜드를 상권·인구 특성 기반으로 제안
          </span>
        )}
      </div>

      {error && (
        <div className="border-[2px] border-[#0a0a0a] bg-rose-100 px-3 py-2 text-[11.5px] font-bold text-rose-700">
          {error}
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2.5">
          {suggestions.map((s) => (
            <div key={s.cat} className="border-[2px] border-[#0a0a0a] bg-white px-3 py-2.5 shadow-[2px_2px_0_0_#0a0a0a]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="border-[1.5px] border-[#0a0a0a] bg-violet-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">{s.cat}</span>
              </div>
              <ul className="space-y-1.5">
                {s.brands.map((b) => (
                  <li key={b.name} className="flex gap-2">
                    <span className="shrink-0 text-[12.5px] font-extrabold text-[#0a0a0a] min-w-[84px]">{b.name}</span>
                    <span className="text-[11.5px] font-medium text-[#0a0a0a]/70 leading-snug">{b.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {suggestions && suggestions.length === 0 && !error && (
        <p className="text-[11.5px] font-bold text-[#0a0a0a]/55">제안된 브랜드가 없습니다.</p>
      )}
    </div>
  );
}
