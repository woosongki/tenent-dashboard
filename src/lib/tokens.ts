/**
 * 디자인 토큰 — lifestyle 보고용 디자인 시스템
 * 원칙: 뉴트럴 90% + violet 액센트 + semantic(emerald/amber/rose)만 허용
 */

export const TOKENS = {
  // ── Surface ──────────────────────────────────────────────
  surface: {
    bg:        "bg-[#f5f7fa]",
    card:      "bg-white",
    cardHover: "bg-[#faf9ff]",
    border:    "border-slate-200",
    divider:   "border-slate-100",
    head:      "bg-slate-50",
    shadow:    "shadow-[0_1px_2px_rgba(15,23,42,.04)]",
    shadowMd:  "shadow-[0_4px_16px_rgba(15,23,42,.06)]",
    shadowLg:  "shadow-[0_12px_32px_rgba(15,23,42,.10)]",
  },

  // ── Semantic ─────────────────────────────────────────────
  semantic: {
    success: { bg: "bg-emerald-50", text: "text-emerald-700", solid: "bg-emerald-500", border: "border-emerald-200" },
    warning: { bg: "bg-amber-50",   text: "text-amber-700",   solid: "bg-amber-400",   border: "border-amber-200" },
    danger:  { bg: "bg-rose-50",    text: "text-rose-700",    solid: "bg-rose-500",    border: "border-rose-200" },
    brand:   { bg: "bg-violet-50",  text: "text-violet-700",  solid: "bg-violet-600",  border: "border-violet-200" },
    info:    { bg: "bg-blue-50",    text: "text-blue-700",    solid: "bg-blue-500",    border: "border-blue-200" },
    neutral: { bg: "bg-slate-100",  text: "text-slate-600",   solid: "bg-slate-400",   border: "border-slate-200" },
  },

  // ── Focus ────────────────────────────────────────────────
  focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",

  // ── Buttons ──────────────────────────────────────────────
  btn: {
    primary:   "rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors",
    secondary: "rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors",
    accent:    "rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-[0_2px_8px_rgba(124,58,237,0.20)]",
    danger:    "rounded-lg bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 transition-colors",
    ghost:     "rounded-lg px-3 py-1.5 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors",
  },

  // ── Input ────────────────────────────────────────────────
  input: "w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] text-slate-800 placeholder-slate-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100",
  label: "mb-1 block text-[12px] font-medium text-slate-600",

  // ── Table ────────────────────────────────────────────────
  th: "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[.08em] text-slate-500 whitespace-nowrap",
  trHover: "group transition-colors hover:bg-slate-50",
} as const;

/**
 * 타이포그래피 토큰 — 보고용 위계 강화
 * 한국어 헤드라인은 tracking 좁히지 않음(자간 답답함 방지)
 */
export const TYPO = {
  pageTitle:    "text-[28px] font-extrabold leading-tight text-slate-900",
  pageSubtitle: "text-[14px] leading-relaxed text-slate-500",
  sectionTitle: "text-[18px] font-bold leading-snug text-slate-900",
  sectionDesc:  "text-[13px] text-slate-500",
  cardTitle:    "text-[15px] font-semibold text-slate-900",
  body:         "text-[14px] leading-relaxed text-slate-700",
  meta:         "text-[12px] text-slate-500",
  micro:        "text-[11px] text-slate-400",
  // KPI 큰 숫자 — tabular nums + tighter tracking으로 디스플레이 효과
  kpiNumber:    "text-[44px] font-bold tabular-nums tracking-tight text-slate-900",
  kpiNumberLg:  "text-[56px] font-bold tabular-nums tracking-tight text-slate-900",
  kpiLabel:     "text-[11px] font-semibold text-slate-500 uppercase tracking-[.1em]",
  // 데이터 강조 (표/숫자열)
  num:          "tabular-nums tracking-tight",
  // 섹션 라벨 (uppercase 작은 글씨)
  eyebrow:      "text-[11px] font-bold uppercase tracking-[.12em] text-violet-600",
} as const;

/**
 * 여백/간격 토큰 — 보고용 권위감을 위한 넉넉한 spacing
 */
export const SPACE = {
  pageX:      "px-8",       // 32px
  pageY:      "py-8",       // 32px
  pageMaxW:   "max-w-[1480px] mx-auto",
  sectionGap: "space-y-8",  // 32px
  cardGap:    "gap-4",      // 16px
  cardP:      "p-6",        // 24px
  cardPCompact: "p-5",      // 20px
} as const;

/**
 * Elevation 3단계 — 위계 분리
 */
export const ELEVATION = {
  flat:    "border border-slate-200 bg-white",
  card:    "border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]",
  raised:  "border border-slate-200/70 bg-white shadow-[0_4px_16px_rgba(15,23,42,.06)]",
  popover: "border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,.12)]",
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
    border:     "border-slate-200",
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
