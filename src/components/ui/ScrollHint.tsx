"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** 스크롤 컨테이너에 그대로 전달될 클래스 (테두리/배경 등) */
  className?: string;
}

/**
 * 가로 스크롤 표 래퍼.
 * - 모바일에서 우측에 더 볼 컬럼이 있으면 페이드 + "← 좌우 스크롤" 힌트 표시
 * - 끝까지 스크롤하면 힌트 자동 숨김
 * - md 이상(데스크탑)은 힌트 비표시 — 전체 컬럼이 보이므로 불필요
 *
 * 사용: 기존 `<div className="overflow-x-auto ...">` → `<ScrollHint className="...">`
 */
export default function ScrollHint({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const scrollable = el.scrollWidth > el.clientWidth + 4;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setShow(scrollable && !atEnd);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className={`overflow-x-auto ${className}`}>
        {children}
      </div>

      {/* 우측 페이드 (모바일 전용) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#FAF7EC] to-transparent transition-opacity duration-300 md:hidden ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* 스크롤 힌트 칩 (모바일 전용) */}
      <span
        aria-hidden
        className={`pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 border-[2px] border-[#0a0a0a] bg-yellow-300 px-2 py-0.5 text-[10px] font-extrabold tracking-tight text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a] transition-opacity duration-300 md:hidden ${
          show ? "opacity-100" : "opacity-0"
        }`}
      >
        ← 좌우 스크롤
      </span>
    </div>
  );
}
