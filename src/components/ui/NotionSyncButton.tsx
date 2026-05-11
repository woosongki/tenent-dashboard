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
    const baseColor = themeIsLight ? "text-slate-600 hover:bg-slate-100" : "text-slate-400 hover:bg-white/5";
    return (
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        title={pending ? "동기화 중..." : "노션에서 최신 데이터 가져오기"}
        className={`flex w-full items-center rounded-[8px] px-2 py-2 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 ${baseColor} ${
          collapsed ? "justify-center" : "gap-2"
        }`}
      >
        {Icon}
        {!collapsed && (
          <span className="text-[12px] font-medium">{pending ? "동기화 중..." : "노션 동기화"}</span>
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
      className="flex h-8 items-center gap-1.5 rounded-lg border-[2px] border-[#0a0a0a] bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      {Icon}
      {pending ? "동기화 중..." : "노션 동기화"}
    </button>
  );
}
