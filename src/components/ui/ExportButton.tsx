"use client";

import { useState } from "react";
import { downloadExcel } from "@/lib/excel";
import type { ExcelColumn } from "@/lib/excel";

interface Props {
  filename: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  label?: string;
}

export default function ExportButton({ filename, columns, rows, label = "Excel 내보내기" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      downloadExcel(filename, columns, rows);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
      {label}
    </button>
  );
}
