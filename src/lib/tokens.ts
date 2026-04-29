/**
 * 디자인 토큰 — Slate Pro 디자인 시스템
 * 컬러 의미 통일: success(emerald) / warning(amber) / danger(rose) / brand(violet) / neutral(slate)
 */

export const TOKENS = {
  // ── Surface ──────────────────────────────────────────────
  surface: {
    bg:        "bg-[#f4f6f9]",
    card:      "bg-white",
    cardHover: "bg-[#faf8ff]",
    border:    "border-[#e8ecf0]",
    divider:   "border-[#f1f5f9]",
    head:      "bg-[#f8fafc]",
    shadow:    "shadow-[0_1px_3px_rgba(0,0,0,.04)]",
    shadowMd:  "shadow-[0_4px_12px_rgba(124,58,237,0.15)]",
  },

  // ── Semantic ─────────────────────────────────────────────
  semantic: {
    success: { bg: "bg-emerald-50", text: "text-emerald-700", solid: "bg-emerald-500" },
    warning: { bg: "bg-amber-50",   text: "text-amber-700",   solid: "bg-amber-400"   },
    danger:  { bg: "bg-rose-50",    text: "text-rose-600",    solid: "bg-rose-500"    },
    brand:   { bg: "bg-violet-50",  text: "text-violet-700",  solid: "bg-violet-600"  },
    info:    { bg: "bg-blue-50",    text: "text-blue-700",    solid: "bg-blue-500"    },
    neutral: { bg: "bg-slate-100",  text: "text-slate-600",   solid: "bg-slate-400"   },
  },

  // ── Focus ────────────────────────────────────────────────
  focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",

  // ── Buttons ──────────────────────────────────────────────
  btn: {
    primary:   "rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-[0_2px_8px_rgba(124,58,237,0.25)]",
    secondary: "rounded-lg border border-[#e8ecf0] px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors",
    danger:    "rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors",
    ghost:     "rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 transition-colors",
  },

  // ── Input ────────────────────────────────────────────────
  input: "w-full rounded-lg border border-[#e8ecf0] px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100",
  label: "mb-1 block text-xs font-medium text-slate-500",

  // ── Table ────────────────────────────────────────────────
  th: "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-slate-400 whitespace-nowrap",
  trHover: "group border-l-[3px] border-l-transparent transition-all hover:border-l-violet-500 hover:bg-[#faf8ff]",
} as const;

/**
 * 사이드바 테마 모드 (다크/라이트)
 */
export const SIDEBAR_THEMES = {
  dark: {
    bg:         "bg-[#0c111d]",
    border:     "border-[#1a2236]",
    text:       "text-slate-100",
    textMuted:  "text-slate-500",
    textActive: "text-violet-300",
    itemActive: "bg-[#1a1040]",
    itemHover:  "hover:bg-[#131c2e] hover:text-slate-200",
    itemBase:   "text-slate-400",
    userBg:     "bg-[#111827]",
  },
  light: {
    bg:         "bg-white",
    border:     "border-[#e8ecf0]",
    text:       "text-slate-900",
    textMuted:  "text-slate-400",
    textActive: "text-violet-700",
    itemActive: "bg-violet-50",
    itemHover:  "hover:bg-slate-50 hover:text-slate-700",
    itemBase:   "text-slate-500",
    userBg:     "bg-slate-50",
  },
} as const;

export type SidebarTheme = keyof typeof SIDEBAR_THEMES;
