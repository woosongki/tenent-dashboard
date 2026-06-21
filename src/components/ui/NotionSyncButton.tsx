"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  /** sidebar: 사이드바에 끼워넣는 컴팩트 변형, default: 페이지 액션용 */
  variant?: "default" | "sidebar";
  /** sidebar variant에서 collapsed일 때 아이콘만 표시 */
  collapsed?: boolean;
  /** sidebar variant에서 라이트/다크 텍스트 색상 결정 */
  themeIsLight?: boolean;
}

export default function NotionSyncButton({
  variant = "default",
  collapsed = false,
  themeIsLight = false,
}: Props = {}) {
  const [pending, startTransition] = useTransition();
  const [, setLastResult] = useState<unknown>(null);
  const router = useRouter();

  function trigger() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/sync/notion", { method: "POST" });
        const json = await res.json();
        setLastResult(json);

        if (!res.ok) {
          toast.error(json.error ?? "동기화 실패", { description: json.hint });
          return;
        }
        const totals = (json.results as Array<{ table: string; fetched: number; upserted: number; errors: string[] }>) ?? [];
        const fetched  = totals.reduce((s, r) => s + r.fetched, 0);
        const upserted = totals.reduce((s, r) => s + r.upserted, 0);
        const errCount = totals.reduce((s, r) => s + r.errors.length, 0);
        toast.success(`노션 동기화 완료 — ${upserted}/${fetched}건 반영`, {
          description: errCount > 0 ? `${errCount}건 오류 발생 (콘솔 확인)` : `${(json.duration_ms / 1000).toFixed(1)}초 소요`,
        });
        router.refresh();
      } catch (e) {
        toast.error("동기화 요청 실패", { description: String(e) });
      }
    });
  }

  const Icon = (
    <svg
      className={`h-3.5 w-3.5 shrink-0 ${pending ? "animate-spin text-violet-500" : variant === "sidebar" ? "" : "text-slate-400"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );

  if (variant === "sidebar") {
    const baseColor = themeIsLight
      ? "text-[#0a0a0a]/75 hover:bg-yellow-200"
      : "text-white/75 hover:bg-white/10";
    return (
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        title={pending ? "동기화 중..." : "노션에서 최신 데이터 가져오기"}
        aria-label="노션 동기화"
        className={`flex w-full items-center px-2 py-2 border-l-[3px] border-transparent transition-colors disabled:opacity-50 ${baseColor} ${
          collapsed ? "justify-center" : "gap-2"
        }`}
      >
        {Icon}
        {!collapsed && (
          <span className="text-[11px] font-extrabold uppercase tracking-wider">{pending ? "동기화 중" : "Sync"}</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={pending}
      title="노션에서 최신 데이터 가져오기"
      className="inline-flex items-center gap-1.5 h-9 text-[11px] font-extrabold uppercase tracking-wider px-3 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:bg-yellow-300 hover:shadow-[3px_3px_0_0_#0a0a0a] disabled:opacity-50 transition-all"
    >
      {Icon}
      {pending ? "동기화 중" : "노션 Sync"}
    </button>
  );
}
