"use client";

import { useEffect, useState } from "react";

/**
 * 클라이언트 마운트 여부. recharts ResponsiveContainer를 SSR/0-size에서
 * 렌더해 width(-1) 경고가 나는 것을 막기 위해, 마운트 후에만 차트를 렌더할 때 사용.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
