"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useTransition,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { FilterDef, UseFilterBarReturn } from "@/types/filterBar";

interface Options {
  /**
   * 필터가 바뀔 때 자동으로 삭제할 파라미터.
   * cursor 기반 페이지네이션이 있을 때 "cursor"를 넘기면 첫 페이지로 돌아갑니다.
   */
  resetOnChange?: string[];
  /**
   * router.replace 대신 router.push를 사용할지 여부.
   * 기본 false (replace — 뒤로가기 히스토리 오염 방지).
   */
  pushHistory?: boolean;
}

/** FilterDef 배열에서 관리하는 모든 URL 파라미터 키를 추출 */
function extractKeys(defs: FilterDef[]): string[] {
  return defs.flatMap((d) => {
    if (d.type === "daterange") return [d.fromKey, d.toKey];
    return [d.key];
  });
}

export function useFilterBar(
  defs: FilterDef[],
  options: Options = {},
): UseFilterBarReturn {
  const { resetOnChange = [], pushHistory = false } = options;

  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // text 필터의 debounce 타이머 관리
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // ── 현재 값 읽기 ──────────────────────────────────────────
  const values = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const key of extractKeys(defs)) {
      result[key] = searchParams.get(key) ?? "";
    }
    return result;
  }, [defs, searchParams]);

  // ── URL 업데이트 내부 함수 ────────────────────────────────
  const applyUpdates = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      // 페이지네이션 커서 등 리셋
      resetOnChange.forEach((k) => params.delete(k));

      Object.entries(updates).forEach(([k, v]) => {
        if (v === "") params.delete(k);
        else params.set(k, v);
      });

      const url = `${pathname}?${params.toString()}`;
      startTransition(() => {
        if (pushHistory) router.push(url);
        else router.replace(url, { scroll: false });
      });
    },
    [searchParams, pathname, resetOnChange, pushHistory, router],
  );

  // ── 공개 API ──────────────────────────────────────────────

  const set = useCallback(
    (key: string, value: string, debounceMs?: number) => {
      if (!debounceMs) {
        applyUpdates({ [key]: value });
        return;
      }
      // text 필터 debounce
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        applyUpdates({ [key]: value });
        debounceTimers.current.delete(key);
      }, debounceMs);
      debounceTimers.current.set(key, timer);
    },
    [applyUpdates],
  );

  const setMany = useCallback(
    (updates: Record<string, string>) => {
      applyUpdates(updates);
    },
    [applyUpdates],
  );

  const reset = useCallback(() => {
    const keys = extractKeys(defs);
    const updates = Object.fromEntries(keys.map((k) => [k, ""]));
    // resetOnChange 키도 함께 제거
    resetOnChange.forEach((k) => { updates[k] = ""; });
    applyUpdates(updates);
  }, [defs, resetOnChange, applyUpdates]);

  const activeCount = useMemo(
    () => Object.values(values).filter(Boolean).length,
    [values],
  );

  return { values, set, setMany, reset, activeCount, isPending };
}
