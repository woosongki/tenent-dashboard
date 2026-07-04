"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Band = number | "all";

interface Props {
  current: { days: Band; store?: string; type?: string; brand?: string };
}

// 브랜드·구매처명 검색. 현재 기간/지점/계약형태 필터는 유지한 채 brand 쿼리만 갱신.
export default function BrandSearch({ current }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(current.brand ?? "");

  function go(brand: string) {
    const p = new URLSearchParams();
    if (current.days === "all") p.set("days", "all");
    else if (current.days !== 60) p.set("days", String(current.days));
    if (current.store) p.set("store", current.store);
    if (current.type) p.set("type", current.type);
    const b = brand.trim();
    if (b) p.set("brand", b);
    const qs = p.toString();
    router.push(`/dashboard/contracts/expiry${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); go(q); }}
      className="flex items-center gap-1.5"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="브랜드·구매처명"
        aria-label="브랜드 검색"
        className="w-44 border-[2px] border-[#0a0a0a] bg-white px-2.5 py-1 text-[12px] font-bold outline-none placeholder:text-[#0a0a0a]/35 focus:bg-yellow-50"
      />
      <button
        type="submit"
        className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-2.5 py-1 text-[11px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
      >
        검색
      </button>
      {current.brand && (
        <button
          type="button"
          onClick={() => { setQ(""); go(""); }}
          aria-label="브랜드 검색 지우기"
          className="border-[2px] border-[#0a0a0a] bg-white px-2 py-1 text-[11px] font-bold hover:bg-[#F1ECDB]"
        >
          ✕
        </button>
      )}
    </form>
  );
}
