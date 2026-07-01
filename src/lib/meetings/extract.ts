// 미팅 원문(TXT/손메모 타이핑)을 룰 기반으로 파싱.
// LLM 없음 — 마커 사전 + 문장 분리 + 조사 제거 방식.
// 서버·클라이언트 양쪽에서 재사용(클라 미리보기 + 서버 저장 시 재계산).

export type SessionCategory =
  | "question"      // ? 종결 또는 질문 마커
  | "unmet"         // 언맷니즈 — 필요/부족/어려움/원한다 등
  | "action"        // 다음 액션 — 예정/체크/확인/공유 등
  | "quote"         // 인용 — 따옴표 안 발언
  | "fact";         // 그 외 사실 진술

export interface ExtractedLine {
  text: string;                 // 원문 그대로의 한 문장
  category: SessionCategory;
  keywords: string[];           // 이 문장에서 뽑힌 명사류 토큰
}

export interface ExtractedSession {
  questions: ExtractedLine[];
  unmetNeeds: ExtractedLine[];
  actionItems: ExtractedLine[];
  quotes: ExtractedLine[];
  facts: ExtractedLine[];       // UI에서는 안 쓰지만 카운트/디버그용
  keywords: { word: string; count: number }[]; // 세션 전체 상위 빈도
}

// ── 마커 사전 ────────────────────────────────────────────────
// 우선순위: quote > action > unmet > question > fact
const QUOTE_MARKERS = [/["'“”「『][^"'“”」』]{3,}["'“”」』]/, /라고\s*(하|말|얘기|언급)/];
const ACTION_MARKERS = [
  /다음\s*미팅/, /다음\s*번/, /다음\s*(주|달|분기)/,
  /하기로/, /할\s*예정/, /할\s*계획/, /~?기로\s*(함|했|해)/,
  /체크\s*(필요|해)/, /확인\s*(필요|해|바|부탁)/,
  /공유\s*(예정|해|바|부탁|필요)/, /보내\s*(주|드리|기로|줌)/,
  /전달\s*(예정|바|부탁|필요)/, /검토\s*(필요|바|부탁|해)/,
  /^\s*(TODO|To-?do|todo|다음)\s*[:：\-\s]/, /^\s*액션\s*[:：\-]/,
];
const UNMET_MARKERS = [
  /필요\s*(하|해|함)/, /필요합니다/, /요\s*가\s*있/, /요구/,
  /부족\s*(하|해|함|합)/, /모자란/, /없\s*(어|음|다|었)/,
  /어렵\s*(다|고|어|네|습)/, /힘들\s*(다|고|어|어요)/,
  /고민\s*(이|중|하)/, /고민입니다/, /고민되/,
  /원한다|원합니다|원해요|원하시/, /바란다|바랍니다|바래/,
  /문제(가|는|입|였|다)/, /이슈(가|는|였|입)/, /불편/,
  /안\s*(된다|되고|되네|되어|돼|되)/, /못\s*(하|했|해)/,
  /아쉬(움|워|운|웠)/, /한계/,
  // ── 확장(2026-07): 흔히 놓치던 언맷 표현 ──
  /느리|느려|느린/, /비싸|비쌈/, /부담(이|을|스럽|된|되|감|스)/,
  /복잡(하|해|한|함)/, /번거(롭|로)/, /귀찮/,
  /걱정|우려/, /떨어(지|져|진)|줄어(들|든|서|요)|하락|감소/,
  /막히|막혀|막힌|지연|늦어(지|진|서)?|늦는/,
  /누락|빠지(는|고|네|어)|빠졌/, /오류|에러|버그|장애/,
  /불만/, /(개선|보완)\s*(이|가|필요|해야|했으면|되)/,
  /(면|으면)\s*좋(겠|을)/, /좋을\s*텐데/,
  /쉽지\s*않|여의치\s*않|곤란/,
];
const QUESTION_MARKERS = [
  /\?\s*$/, /인가요\s*[?？]?$/, /입니까\s*[?？]?$/, /할까요/, /하나요/,
  /어떻게/, /어떤/, /왜\s/, /언제/, /어디/, /누가/, /얼마/,
  /가능\s*(한|할|해요|합|한지)/, /여쭙|여쭤|묻고\s*싶|궁금/,
];

// 문장 종결 부호 기준 분리 — 개행도 강한 구분자로 취급.
export function splitSentences(raw: string): string[] {
  if (!raw) return [];
  // 개행 정규화 → 문장 종결(., !, ?, 한자 마침표) 뒤에서 자름.
  // 손메모라 완벽하진 않아도, 개행 + 종결부호로 대부분 커버됨.
  const norm = raw
    .replace(/\r\n?/g, "\n")
    .replace(/。/g, ".")   // 。 → .
    .replace(/[ \t]+/g, " ");
  const chunks: string[] = [];
  for (const line of norm.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 종결부호 뒤에서 split — 부호는 유지.
    const parts = trimmed.split(/(?<=[.!?？！])\s+/);
    for (const p of parts) {
      const t = p.trim();
      if (t.length >= 2) chunks.push(t);
    }
  }
  return chunks;
}

// ── 카테고리 판정 (우선순위 순) ──────────────────────────────
function categorize(sentence: string): SessionCategory {
  if (QUOTE_MARKERS.some((r) => r.test(sentence))) return "quote";
  if (ACTION_MARKERS.some((r) => r.test(sentence))) return "action";
  // 명시적 물음표 종결은 언맷보다 우선 — "개선이 필요한가요?"를 언맷 아닌 질문으로.
  if (/[?？]\s*$/.test(sentence)) return "question";
  if (UNMET_MARKERS.some((r) => r.test(sentence))) return "unmet";
  if (QUESTION_MARKERS.some((r) => r.test(sentence))) return "question";
  return "fact";
}

// 액션 문장에서 기한 힌트 추출 (룰 기반 — 없으면 undefined).
const DUE_PATTERNS: RegExp[] = [
  /(이번\s*주|다음\s*주|금주|차주|월말|월초|연말|분기\s*말|다음\s*미팅|[0-9]{1,2}\s*월(\s*[0-9]{1,2}\s*일)?|[0-9]{1,2}\/[0-9]{1,2}|[월화수목금토일]요일)\s*까지/,
  /다음\s*미팅/,
  /(다음|차)\s*주/, /이번\s*주/, /금주/,
  /(다음|이번)\s*(달|분기)/,
  /[0-9]{1,2}\s*월\s*[0-9]{1,2}\s*일/, /[0-9]{1,2}\s*월(?![0-9])/, /[0-9]{1,2}\/[0-9]{1,2}/,
  /[월화수목금토일]요일/,
];
function parseDue(text: string): string | undefined {
  for (const p of DUE_PATTERNS) {
    const m = text.match(p);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return undefined;
}

// ── 명사류 키워드 뽑기 ─────────────────────────────────────
// 완벽한 형태소 분석은 못 하지만, 조사·어미 절단 + 한국어 2글자 이상 토큰만 취함.
const STOPWORDS = new Set([
  "그리고","그런데","하지만","저희","우리","이번","다음","저는","지금","해서","라고",
  "이는","이런","저런","같은","입니다","있습니다","합니다","됩니다","것은","것이","것을",
  "정도","때문","경우","수있","있는","없는","해서","해도","해요","했어","했다","한다",
  "그것","이것","저것","여기","거기","저기","오늘","내일","어제","이후","이전","현재",
]);
const KOREAN_JOSA = /(은|는|이|가|을|를|의|에|에서|에게|한테|께|와|과|랑|하고|이나|나|도|만|까지|부터|처럼|보다|마다|이며|이고|이라|이지|입니다|이다|이라고|라고)$/;

export function tokenizeKeywords(sentence: string): string[] {
  const out: string[] = [];
  // 한글/영문 연속 청크만 추림 — 숫자 단독은 제외.
  const raw = sentence.match(/[가-힣A-Za-z][가-힣A-Za-z0-9]{1,}/g) ?? [];
  for (const word of raw) {
    let w = word;
    // 반복 절단: 조사가 붙어 있으면 잘라냄 (한 번만).
    const stripped = w.replace(KOREAN_JOSA, "");
    if (stripped.length >= 2) w = stripped;
    if (w.length < 2) continue;
    if (STOPWORDS.has(w)) continue;
    if (/^[0-9]+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

// ── 메인 파서 ───────────────────────────────────────────────
export function extractSession(rawText: string): ExtractedSession {
  const questions: ExtractedLine[] = [];
  const unmetNeeds: ExtractedLine[] = [];
  const actionItems: ExtractedLine[] = [];
  const quotes: ExtractedLine[] = [];
  const facts: ExtractedLine[] = [];
  const wordCount = new Map<string, number>();

  const sentences = splitSentences(rawText);
  for (const s of sentences) {
    const cat = categorize(s);
    const kws = tokenizeKeywords(s);
    kws.forEach((k) => wordCount.set(k, (wordCount.get(k) ?? 0) + 1));
    const line: ExtractedLine = { text: s, category: cat, keywords: kws };
    if (cat === "question") questions.push(line);
    else if (cat === "unmet") unmetNeeds.push(line);
    else if (cat === "action") actionItems.push(line);
    else if (cat === "quote") quotes.push(line);
    else facts.push(line);
  }

  const keywords = [...wordCount.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 15);

  return { questions, unmetNeeds, actionItems, quotes, facts, keywords };
}

// ── 수동 편집된 extracted 정제 ───────────────────────────────
// 사용자가 항목을 추가/수정/삭제한 뒤 저장할 때, 텍스트만 신뢰하고 키워드·집계는 재계산.
export function sanitizeExtracted(input: Partial<ExtractedSession> | null | undefined): ExtractedSession {
  const build = (arr: unknown, category: SessionCategory): ExtractedLine[] =>
    (Array.isArray(arr) ? arr : [])
      .map((l) => {
        const text = String((l as { text?: unknown })?.text ?? "").trim().slice(0, 1000);
        return text ? { text, category, keywords: tokenizeKeywords(text) } : null;
      })
      .filter((l): l is ExtractedLine => l !== null)
      .slice(0, 300);
  const questions = build(input?.questions, "question");
  const unmetNeeds = build(input?.unmetNeeds, "unmet");
  const actionItems = build(input?.actionItems, "action");
  const quotes = build(input?.quotes, "quote");
  const facts = build(input?.facts, "fact");
  const wc = new Map<string, number>();
  for (const l of [...questions, ...unmetNeeds, ...actionItems, ...quotes, ...facts])
    l.keywords.forEach((k) => wc.set(k, (wc.get(k) ?? 0) + 1));
  const keywords = [...wc.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 15);
  return { questions, unmetNeeds, actionItems, quotes, facts, keywords };
}

// ── 여러 세션 크로스 집계 (Accumulated Insights) ───────────
export interface AccumulatedInsights {
  recurringNeeds: { text: string; sessions: number[] }[];   // 여러 세션에서 반복된 언맷니즈
  openQuestions: { text: string; sessionIndex: number }[];  // 최신 질문(중복 제거)
  actionLog: { text: string; sessionIndex: number; heldAt: string; due?: string }[]; // 액션 타임라인(기한 힌트 포함)
  topKeywords: { word: string; count: number }[];           // 전체 상위 키워드
}

interface SessionForAggregate {
  session_index: number;
  held_at: string;
  extracted: ExtractedSession | null;
}

// 텍스트 정규화 — 유사 문장 매칭용 (공백·부호·조사 제거).
function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(KOREAN_JOSA, "");
}

export function aggregateSessions(sessions: SessionForAggregate[]): AccumulatedInsights {
  const needBuckets = new Map<string, { text: string; sessions: Set<number> }>();
  const openQuestions: { text: string; sessionIndex: number }[] = [];
  const actionLog: { text: string; sessionIndex: number; heldAt: string; due?: string }[] = [];
  const kwCount = new Map<string, number>();
  const seenQ = new Set<string>();   // 질문 중복 제거
  const seenA = new Set<string>();   // 액션 중복 제거

  // 최신 세션이 먼저 오도록 정렬 (session_index desc).
  const sorted = [...sessions].sort((a, b) => b.session_index - a.session_index);

  for (const s of sorted) {
    const ex = s.extracted;
    if (!ex) continue;

    // 언맷니즈 — 정규화 텍스트로 클러스터링.
    for (const u of ex.unmetNeeds) {
      const key = norm(u.text).slice(0, 40); // 앞 40자만 키로 사용 (전체 매칭보다 관대)
      if (!key) continue;
      const b = needBuckets.get(key) ?? { text: u.text, sessions: new Set<number>() };
      b.sessions.add(s.session_index);
      needBuckets.set(key, b);
    }

    // 미해결 질문 — 최신 세션부터, 중복 제거, 최대 8개.
    for (const q of ex.questions) {
      if (openQuestions.length >= 8) break;
      const qk = norm(q.text).slice(0, 40);
      if (qk && seenQ.has(qk)) continue;
      if (qk) seenQ.add(qk);
      openQuestions.push({ text: q.text, sessionIndex: s.session_index });
    }

    // 액션 — 최신 세션 먼저, 동일 문장 중복 제거, 기한 힌트 파싱.
    for (const a of ex.actionItems) {
      const ak = norm(a.text).slice(0, 50);
      if (ak && seenA.has(ak)) continue;
      if (ak) seenA.add(ak);
      actionLog.push({ text: a.text, sessionIndex: s.session_index, heldAt: s.held_at, due: parseDue(a.text) });
    }

    // 키워드 누적.
    for (const k of ex.keywords) {
      kwCount.set(k.word, (kwCount.get(k.word) ?? 0) + k.count);
    }
  }

  const recurringNeeds = [...needBuckets.values()]
    .filter((b) => b.sessions.size >= 2) // 2세션 이상 등장한 것만 "반복"
    .map((b) => ({ text: b.text, sessions: [...b.sessions].sort((a, b) => a - b) }))
    .sort((a, b) => b.sessions.length - a.sessions.length);

  // 세션이 1개뿐이면 recurring이 빌 수밖에 없음 — 그 경우엔 최신 세션의 언맷니즈 top 5를 노출.
  if (recurringNeeds.length === 0 && sorted.length > 0) {
    const latest = sorted[0];
    if (latest.extracted) {
      for (const u of latest.extracted.unmetNeeds.slice(0, 5)) {
        recurringNeeds.push({ text: u.text, sessions: [latest.session_index] });
      }
    }
  }

  const topKeywords = [...kwCount.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 20);

  return { recurringNeeds, openQuestions, actionLog, topKeywords };
}
