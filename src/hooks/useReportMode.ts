"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "lifestyle.reportMode";

/**
 * 임원 보고 모드 — 형광 액센트를 paper/yellow-light로 톤다운.
 * body에 .mono 클래스를 toggle.
 */
export function useReportMode(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "1") setEnabled(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("mono", enabled);
  }, [enabled]);

  function update(v: boolean) {
    setEnabled(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    }
  }

  return [enabled, update];
}
