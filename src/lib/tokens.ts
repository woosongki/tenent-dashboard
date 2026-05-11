/**
 * 디자인 토큰 — Neo-Brutalist (이랜드리테일 lifestyle 보고용)
 * 원칙: 굵은 검정 테두리(2~3px) + offset shadow + 형광 액센트 + 모노 숫자.
 */

export const INK = "#0a0a0a";
export const PAPER = "#FAF7EC";
export const PAPER_SOFT = "#F1ECDB";

// Brutalist surface 유틸리티 클래스 (globals.css와 동기화)
export const BRUTAL = {
  card:    "brutal",       // 2px border + 4px offset
  cardLg:  "brutal-lg",    // 3px border + 6px offset
  cardSm:  "brutal-sm",    // 2px border + 3px offset
  flat:    "brutal-flat",
  hover:   "brutal-hover",
} as const;

export const ACCENT = {
  teal:    "chip-teal",
  magenta: "chip-magenta",
  yellow:  "chip-yellow",
  violet:  "chip-violet",
  ink:     "chip-ink",
  paper:   "chip-paper",
} as const;

export const TOKENS = {
  surface: {
    bg:        "bg-[#FAF7EC]",
    card:      "bg-white",
    cardHover: "bg-[#fffef8]",
    border:    "border-[#0a0a0a]",
    divider:   "border-[#0a0a0a]/15",
    head:      "bg-[#F1ECDB]",
    shadow:    "shadow-[4px_4px_0_0_#0a0a0a]",
    shadowMd:  "shadow-[6px_6px_0_0_#0a0a0a]",
    shadowLg:  "shadow-[9px_9px_0_0_#0a0a0a]",
  },

  semantic: {
    success: { bg: "bg-emerald-400",  text: "text-emerald-950", solid: "bg-emerald-500", border: "border-[#0a0a0a]" },
    warning: { bg: "bg-amber-300",    text: "text-amber-950",   solid: "bg-amber-400",   border: "border-[#0a0a0a]" },
    danger:  { bg: "bg-rose-500",     text: "text-white",       solid: "bg-rose-500",    border: "border-[#0a0a0a]" },
    brand:   { bg: "bg-violet-500",   text: "text-white",       solid: "bg-violet-600",  border: "border-[#0a0a0a]" },
    info:    { bg: "bg-cyan-400",     text: "text-cyan-950",    solid: "bg-cyan-500",    border: "border-[#0a0a0a]" },
    neutral: { bg: "bg-[#F1ECDB]",    text: "text-slate-900",   solid: "bg-slate-700",   border: "border-[#0a0a0a]" },
  },

  focus: "focus-visible:outline-3 focus-visible:outline-amber-400 focus-visible:outline-offset-2",

  btn: {
    // 모두 검정 테두리 + offset shadow. variant마다 배경 다름.
    primary:   "inline-flex items-center justify-center gap-1.5 rounded-none border-[2px] border-[#0a0a0a] bg-[#0a0a0a] px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-white shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#0a0a0a] transition-all disabled:opacity-50",
    secondary: "inline-flex items-center justify-center gap-1.5 rounded-none border-[2px] border-[#0a0a0a] bg-white px-4 py-2 text-[13px] font-bold text-[#0a0a0a] shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#0a0a0a] transition-all",
    accent:    "inline-flex items-center justify-center gap-1.5 rounded-none border-[2px] border-[#0a0a0a] bg-cyan-400 px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-[#0a0a0a] shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#0a0a0a] transition-all",
    danger:    "inline-flex items-center justify-center gap-1.5 rounded-none border-[2px] border-[#0a0a0a] bg-rose-500 px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-white shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] transition-all",
    ghost:     "inline-flex items-center justify-center gap-1.5 rounded-none px-3 py-1.5 text-[13px] font-bold text-[#0a0a0a] hover:bg-[#F1ECDB] transition-colors",
  },

  input: "w-full rounded-none border-[2px] border-[#0a0a0a] bg-white px-3 py-2 text-[14px] text-[#0a0a0a] placeholder-slate-400 shadow-[3px_3px_0_0_#0a0a0a] focus:outline-none focus:shadow-[4px_4px_0_0_#0a0a0a] focus:translate-x-[-1px] focus:translate-y-[-1px] transition-all",
  label: "mb-1.5 block text-[11px] font-bold uppercase tracking-[.1em] text-[#0a0a0a]",

  th: "px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] bg-[#F1ECDB] whitespace-nowrap border-b-[2px] border-[#0a0a0a]",
  trHover: "group border-b border-[#0a0a0a]/12 transition-colors hover:bg-[#fffef8]",
} as const;

/**
 * 타이포그래피 토큰 — Neo-Brutalist
 * 한국어 본문 가독성 유지 + 영문/숫자는 디스플레이/모노 강조.
 */
export const TYPO = {
  pageTitle:    "font-display text-[44px] sm:text-[52px] leading-[.95] tracking-tight text-[#0a0a0a] uppercase",
  pageSubtitle: "text-[14px] leading-relaxed text-[#0a0a0a]/70 font-medium",
  sectionTitle: "text-[20px] font-extrabold tracking-tight text-[#0a0a0a] uppercase",
  sectionDesc:  "text-[13px] text-[#0a0a0a]/70",
  cardTitle:    "text-[16px] font-extrabold text-[#0a0a0a]",
  body:         "text-[14px] leading-relaxed text-[#0a0a0a]",
  meta:         "text-[12px] text-[#0a0a0a]/65 font-medium",
  micro:        "text-[11px] text-[#0a0a0a]/55 font-medium",
  // 핵심 KPI — 모노 + 매우 큼
  kpiNumber:    "font-mono text-[56px] font-extrabold tabular-nums tracking-tight leading-none text-[#0a0a0a]",
  kpiNumberLg:  "font-mono text-[72px] font-extrabold tabular-nums tracking-tight leading-none text-[#0a0a0a]",
  kpiLabel:     "text-[11px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]",
  num:          "font-mono tabular-nums",
  // Eyebrow 칩 (작은 라벨)
  eyebrow:      "inline-block text-[10px] font-extrabold uppercase tracking-[.16em] px-2 py-0.5 border-[2px] border-[#0a0a0a] bg-yellow-300 text-[#0a0a0a]",
} as const;

export const SPACE = {
  pageX:      "px-6 sm:px-8",
  pageY:      "py-8",
  pageMaxW:   "max-w-[1480px] mx-auto",
  sectionGap: "space-y-8",
  cardGap:    "gap-5",
  cardP:      "p-6",
  cardPCompact: "p-5",
} as const;

export const ELEVATION = {
  flat:    "brutal-flat",
  card:    "brutal",
  raised:  "brutal-lg",
  popover: "brutal-lg",
} as const;

/**
 * 사이드바 테마 — Neo-Brutalist
 * 다크 = 검정 / 라이트 = 페이퍼 베이지. 두 모드 모두 굵은 테두리 + offset shadow.
 */
export const SIDEBAR_THEMES = {
  dark: {
    bg:         "bg-[#0a0a0a]",
    border:     "border-[#0a0a0a]",
    text:       "text-white",
    textMuted:  "text-white/55",
    textActive: "text-yellow-300",
    itemActive: "bg-yellow-300/10 border-l-[4px] border-yellow-300",
    itemHover:  "hover:bg-white/5 hover:text-white",
    itemBase:   "text-white/75 border-l-[4px] border-transparent",
    userBg:     "bg-white/5",
  },
  light: {
    bg:         "bg-[#FAF7EC]",
    border:     "border-[#0a0a0a]",
    text:       "text-[#0a0a0a]",
    textMuted:  "text-[#0a0a0a]/60",
    textActive: "text-[#0a0a0a]",
    itemActive: "bg-yellow-300 border-l-[4px] border-[#0a0a0a]",
    itemHover:  "hover:bg-white hover:text-[#0a0a0a]",
    itemBase:   "text-[#0a0a0a]/80 border-l-[4px] border-transparent",
    userBg:     "bg-white border-[2px] border-[#0a0a0a]",
  },
} as const;

export type SidebarTheme = keyof typeof SIDEBAR_THEMES;
