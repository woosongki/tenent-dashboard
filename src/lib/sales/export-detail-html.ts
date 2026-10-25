// 매출분석 > 당월상세(OfflineDetailTab)를 단독 HTML 파일 1개로 내보내기.
// 원칙(브랜드컨셉등급 내보내기와 동일):
//   - 숫자는 서버에서 공용 계산(lib/sales/detail.ts)으로 확정해 심는다. 파일 안에서 재계산하지 않는다.
//   - 외부 CDN·폰트·API 호출 0건(오프라인에서 그대로 열려야 공유 자료로 쓸 수 있다).
//   - 데이터는 JSON으로 심고 DOM은 textContent로만 채운다(브랜드·지점명 HTML 주입 차단).
// 비포함: 🔍 진단 패널(코호트 비교 서술형) — 상호작용 분석이라 스냅샷에서는 제외.

import { buildDetailChips, buildScopeSummary, buildStoreData, selectCatRows,
  type CatSummary, type DivSummary } from "./detail";
import type { OffOthers, OffRank, OffSub } from "./queries";

export interface SalesDetailExportInput {
  periodLabel: string;
  prevLabel: string;
  brands: OffRank[];          // detailBrands (division/cat 포함)
  stores: OffRank[];
  divisions: DivSummary[];
  fashionCats: CatSummary[];
  others?: OffOthers | null;
  /** 누적 개월수. >1 이면 하위 표에 "월평균" 컬럼. 당월상세=1. */
  monthCount?: number;
  generatedAt: string;
}

/** 하위 표가 실제로 쓰는 필드만 — 파일 크기를 불필요하게 키우지 않는다. */
function slimSub(s: OffSub) {
  return {
    key: s.key, s: s.s, ps: s.ps, g: s.g, pg: s.pg,
    growthS: s.growthS, growthPct: s.growthPct, growthG: s.growthG, growthGPct: s.growthGPct,
    area: s.area, dppSales: s.dppSales, prevDppSales: s.prevDppSales, dppSalesGrowthPct: s.dppSalesGrowthPct,
    closed: s.closed ?? false,
  };
}
function slimRow(r: OffRank) {
  return {
    key: r.key, s: r.s, ps: r.ps, g: r.g, gpm: r.gpm, yoyPct: r.yoyPct,
    subCount: r.subCount, dppSales: r.dppSales, prevDppSales: r.prevDppSales,
    dppSalesGrowthPct: r.dppSalesGrowthPct, closed: r.closed ?? false,
    bySub: (r.bySub ?? []).map(slimSub),
  };
}

function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function salesDetailExportFilename(periodLabel: string, generatedAt: string): string {
  const period = periodLabel.replace(/[^0-9A-Za-z-]/g, "") || "period";
  return `sales-month-detail-${period}-${generatedAt.slice(0, 10)}.html`;
}

export function renderSalesDetailHtml(input: SalesDetailExportInput): string {
  const { periodLabel, prevLabel, brands, stores, divisions, fashionCats, others, generatedAt } = input;
  const monthCount = input.monthCount ?? 1;

  const chips = buildDetailChips(divisions, fashionCats, others);

  // 스코프별로 서버에서 확정 — 브랜드 행은 칩끼리 겹치지 않으므로(분할) 파일 크기는 선형.
  const scopes = chips.map((c) => {
    const sel = { type: c.type, key: c.key };
    const catRows = selectCatRows(sel, brands, others);
    return {
      id: `${c.type}-${c.key}`,
      label: c.label,
      s: c.s,
      isFashion: c.type === "cat",
      summary: buildScopeSummary(catRows),
      brandRows: catRows.map(slimRow),
      storeRows: buildStoreData(sel, stores, brands, others).map(slimRow),
    };
  });

  const payload = {
    periodLabel,
    prevLabel,
    generatedAt,
    monthCount,
    scopes,
    allStores: stores.map(slimRow),
    storeCount: stores.length,
  };

  const stamp = new Date(generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>매출분석 당월상세 ${escapeHtml(periodLabel)}</title>
<style>
  :root { --ink:#0a0a0a; --bg:#FAF7EC; --bg2:#F1ECDB; --mut:#64748b; --line:#e2e8f0; --up:#0d9e6e; --down:#e53e3e; --new:#7c3aed; }
  * { box-sizing:border-box; }
  body { margin:0; padding:20px 16px 48px; background:var(--bg); color:var(--ink);
         font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Segoe UI",system-ui,sans-serif;
         font-size:13px; line-height:1.5; }
  .wrap { max-width:1280px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
  .card { border:2px solid var(--ink); background:#fff; box-shadow:3px 3px 0 0 var(--ink); padding:16px; }
  h1 { margin:0; font-size:22px; font-weight:800; letter-spacing:-0.01em; }
  .eyebrow { margin:0 0 4px; font-size:10.5px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:rgba(10,10,10,.6); }
  .sub { margin:8px 0 0; font-size:12px; color:var(--mut); }
  .stamp { display:inline-block; margin-top:10px; border:2px solid var(--ink); background:#fde047; padding:3px 8px; font-size:11px; font-weight:800; }
  .unit { display:inline-block; border:1.5px solid var(--ink); background:var(--bg2); padding:1px 6px; font-size:10px; font-weight:800; }
  .row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
  button.pill, button.chip { border:2px solid var(--ink); background:#fff; padding:6px 12px; font:inherit; font-size:12px; font-weight:700; cursor:pointer; }
  button.pill.on { background:var(--ink); color:#fff; box-shadow:2px 2px 0 0 var(--ink); }
  button.chip.on { color:#fff; box-shadow:2px 2px 0 0 var(--ink); }
  button.chip .amt { margin-left:6px; font-family:ui-monospace,Menlo,monospace; font-size:10px; opacity:.7; }
  input[type=search] { border:2px solid var(--ink); background:#fff; padding:6px 8px; font:inherit; font-size:12px; outline:none; min-width:200px; }
  .cards { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
  @media (min-width:900px) { .cards { grid-template-columns:repeat(6,1fr); gap:10px; } }
  .kpi { border:2px solid var(--ink); background:#fff; box-shadow:3px 3px 0 0 var(--ink); padding:10px; overflow:hidden; }
  .kpi.ac { background:#fef9c3; }
  .kpi .lbl { font-size:11px; font-weight:700; color:var(--mut); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .kpi .val { margin-top:4px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:19px; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }
  .kpi .sb { margin-top:4px; font-size:10px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .scroll { overflow-x:auto; border:2px solid var(--ink); background:#fff; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead.dark th { background:var(--ink); color:#fff; padding:8px 10px; text-align:left; white-space:nowrap; font-weight:800; font-size:11.5px; }
  thead.dark th.s { cursor:pointer; user-select:none; }
  thead.dark th.s:hover { background:#262626; }
  th.r, td.r { text-align:right; }
  tbody td { padding:7px 10px; border-top:1px solid var(--line); }
  tr.main { cursor:pointer; }
  tr.main:hover { background:#fefce8; }
  tr.main.open { background:#fef9c3; }
  tr.main.closed { opacity:.6; cursor:default; }
  .num { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .b { font-weight:700; }
  .mut { color:var(--mut); }
  .tag { margin-left:6px; border:1px solid var(--down); color:var(--down); padding:0 3px; font-size:9px; font-weight:800; }
  .more { width:100%; border:0; border-top:2px solid var(--ink); background:#fefce8; padding:9px; font:inherit; font-size:12px; font-weight:700; cursor:pointer; }
  .more:hover { background:#fef9c3; }
  .subwrap { background:#f8fafc; }
  .subwrap .cap { font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px; }
  .subtbl { min-width:760px; font-size:11px; }
  .subtbl thead th { color:var(--mut); padding:4px 8px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--line); cursor:pointer; user-select:none; font-weight:700; }
  .subtbl thead th:hover { color:var(--ink); }
  .subtbl tbody td { padding:4px 8px; border-bottom:1px solid #f1f5f9; }
  .submore { width:100%; border:0; border-top:1px solid var(--line); background:#f1f5f9; padding:7px; font:inherit; font-size:11px; font-weight:700; cursor:pointer; }
  .empty { padding:30px; text-align:center; color:#94a3b8; }
  .foot { font-size:10.5px; color:rgba(10,10,10,.6); }
  .legend { font-size:10.5px; color:var(--mut); }
  .legend b { font-weight:800; }
</style>
</head>
<body>
<div class="wrap">
  <header class="card">
    <p class="eyebrow">SALES ANALYTICS · MONTH DETAIL</p>
    <h1>매출분석 당월상세 · ${escapeHtml(periodLabel)}</h1>
    <p class="sub">복종(패션)·부문(F&amp;B 등)별 브랜드·지점 실적. 전년 동기 ${escapeHtml(prevLabel)} 대비. 읽기 전용 스냅샷입니다.</p>
    <p class="sub"><span class="unit">단위: 백만원</span>
      <span class="legend" style="margin-left:8px"><b style="color:#e53e3e">퇴점</b> 전년 실적만 있고 올해 매출 없음 · <b style="color:#7c3aed">신규</b> 전년 동기 실적 없음</span></p>
    <span class="stamp">스냅샷 ${escapeHtml(stamp)} (KST)</span>
  </header>

  <div class="row">
    <button class="pill on" id="vBrand" type="button">브랜드별</button>
    <button class="pill" id="vStore" type="button">지점별</button>
  </div>

  <div class="row" id="chips"></div>
  <div class="row">
    <input type="search" id="q" placeholder="검색">
    <span class="mut" id="hint"></span>
  </div>

  <div class="cards" id="cards"></div>

  <div class="scroll">
    <table>
      <thead class="dark"><tr id="head"></tr></thead>
      <tbody id="tb"></tbody>
    </table>
    <button class="more" id="more" style="display:none" type="button"></button>
  </div>

  <p class="foot" id="footNote"></p>
</div>

<script type="application/json" id="sales-data">${embedJson(payload)}</script>
<script>
(function () {
  var D = JSON.parse(document.getElementById("sales-data").textContent);
  var MC = D.monthCount, showAvg = MC > 1;

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x !== undefined && x !== null) n.textContent = String(x); return n; }
  function won(n) { return Math.round(n).toLocaleString("ko-KR"); }
  function mil(n) { return Math.round(n / 1e6).toLocaleString("ko-KR"); }
  function milSigned(n) { return (n >= 0 ? "+" : "") + Math.round(n / 1e6).toLocaleString("ko-KR"); }
  function eok(n) { return (n / 1e8).toFixed(1); }

  // 전년비 셀: 퇴점 / 신규 / ▲▼%
  function yoyCell(pct, prev, closed) {
    if (closed) { var c = el("span", "b", "퇴점"); c.style.color = "var(--down)"; return c; }
    if (prev === 0) { var n = el("span", "b", "신규"); n.style.color = "var(--new)"; return n; }
    var up = pct >= 0;
    var s = el("span", "num b", (up ? "▲ " : "▼ ") + Math.abs(pct).toFixed(1) + "%");
    s.style.color = up ? "var(--up)" : "var(--down)";
    return s;
  }

  var view = "brand";
  var scopeIdx = 0;              // 브랜드별: 항상 칩 하나 선택
  var storeScope = -1;           // 지점별: -1 = 전체
  var q = "", limit = 20, openKey = null;
  var sortKey = "s", sortDir = "desc";       // 메인 표
  var subSort = "s", subDir = "desc";        // 하위 표(펼친 행 공통)
  var subLimit = {};

  function curScope() { return D.scopes[scopeIdx] || null; }

  function mainRows() {
    var list;
    if (view === "brand") {
      var sc = curScope();
      if (!sc) return [];
      list = q ? [].concat.apply([], D.scopes.map(function (x) { return x.brandRows; }))
                   .filter(function (r) { return r.key.indexOf(q) >= 0; })
               : sc.brandRows;
    } else {
      list = storeScope < 0 ? D.allStores : (D.scopes[storeScope] ? D.scopes[storeScope].storeRows : []);
      if (q) list = list.filter(function (r) { return r.key.indexOf(q) >= 0; });
    }
    var dir = sortDir === "asc" ? 1 : -1;
    return list.slice().sort(function (a, b) {
      return sortKey === "key" ? a.key.localeCompare(b.key, "ko") * dir : (a[sortKey] - b[sortKey]) * dir;
    });
  }

  // ── 칩 ───────────────────────────────────────────────
  function renderChips() {
    var box = document.getElementById("chips");
    box.textContent = "";
    if (view === "store") {
      var all = el("button", "chip" + (storeScope < 0 ? " on" : ""), "전체");
      if (storeScope < 0) all.style.background = "#0a0a0a";
      all.addEventListener("click", function () { storeScope = -1; reset(); });
      box.appendChild(all);
    }
    D.scopes.forEach(function (sc, i) {
      var on = view === "brand" ? i === scopeIdx : i === storeScope;
      var b = el("button", "chip" + (on ? " on" : ""), sc.label);
      if (on) b.style.background = sc.isFashion ? "#db2777" : "#7c3aed";
      if (view === "brand") {
        var amt = el("span", "amt", eok(sc.s) + "억");
        b.appendChild(amt);
      }
      b.addEventListener("click", function () {
        if (view === "brand") scopeIdx = i; else storeScope = i;
        reset();
      });
      box.appendChild(b);
    });
  }

  // ── 요약 카드(브랜드별에서만) ─────────────────────────
  function renderCards() {
    var box = document.getElementById("cards");
    box.textContent = "";
    if (view !== "brand") { box.style.display = "none"; return; }
    box.style.display = "";
    var sc = curScope(); if (!sc) return;
    var m = sc.summary;
    function card(lbl, val, sb, tone, ac) {
      var c = el("div", "kpi" + (ac ? " ac" : ""));
      c.appendChild(el("div", "lbl", lbl));
      var v = el("div", "val", val);
      if (tone) v.style.color = tone === "up" ? "var(--up)" : "var(--down)";
      c.appendChild(v);
      if (sb) c.appendChild(el("div", "sb", sb));
      box.appendChild(c);
    }
    card(sc.label + " 매출", eok(m.s) + "억", won(m.s) + "원", null, true);
    card("전년 (" + D.prevLabel + ")", eok(m.ps) + "억");
    card("전년대비", (m.yoyPct >= 0 ? "+" : "") + m.yoyPct + "%", null, m.yoyPct >= 0 ? "up" : "down");
    card("이익률 / 브랜드수", m.gpm + "%", m.brands + "개 브랜드" + (m.closedCount ? " · 퇴점 " + m.closedCount : ""));
    card("일평당매출", won(m.dppSales), "원/평·일");
    card("일평당매출 성장율",
      m.prevDppSales === 0 ? "신규" : (m.dppSalesGrowthPct >= 0 ? "+" : "") + m.dppSalesGrowthPct + "%",
      m.prevDppSales === 0 ? "전기 없음" : "전기 " + won(m.prevDppSales) + "원/평·일",
      m.prevDppSales === 0 ? null : m.dppSalesGrowthPct >= 0 ? "up" : "down");
  }

  // ── 메인 표 헤더 ─────────────────────────────────────
  var HEAD = [
    { k: "key", t: function () { return view === "brand" ? "브랜드" : "지점"; }, align: "l" },
    { k: "subCount", t: function () { return view === "brand" ? "매장수" : "브랜드수"; }, align: "r" },
    { k: "s", t: function () { return "매출(백만)"; }, align: "r" },
    { k: "g", t: function () { return view === "brand" ? "이익(백만)" : "매총익(백만)"; }, align: "r" },
    { k: "gpm", t: function () { return "이익률"; }, align: "r" },
    { k: "dppSales", t: function () { return "일평당매출"; }, align: "r" },
    { k: "dppSalesGrowthPct", t: function () { return "일평당매출 성장율"; }, align: "r" },
    { k: "yoyPct", t: function () { return "전년비"; }, align: "r" }
  ];
  function renderHead() {
    var tr = document.getElementById("head");
    tr.textContent = "";
    tr.appendChild(el("th", null, "#"));
    HEAD.forEach(function (h) {
      var th = el("th", "s" + (h.align === "r" ? " r" : ""), h.t() + (sortKey === h.k ? (sortDir === "asc" ? " ▲" : " ▼") : ""));
      th.addEventListener("click", function () {
        if (sortKey === h.k) sortDir = sortDir === "asc" ? "desc" : "asc";
        else { sortKey = h.k; sortDir = h.k === "key" ? "asc" : "desc"; }
        openKey = null; limit = view === "brand" ? 20 : 10;
        render();
      });
      tr.appendChild(th);
    });
  }

  // ── 하위 표(펼침) ────────────────────────────────────
  var SUB = [
    { k: "key", t: "", align: "l" },
    { k: "s", t: "매출(백만)", align: "r" },
    { k: "growthS", t: "성장액(백만)", align: "r" },
    { k: "growthPct", t: "성장율", align: "r" },
    { k: "g", t: "매총익(백만)", align: "r" },
    { k: "growthG", t: "매총익성장액(백만)", align: "r" },
    { k: "growthGPct", t: "매총익성장율", align: "r" },
    { k: "area", t: "전용면적", align: "r" },
    { k: "dppSales", t: "일평당매출", align: "r" },
    { k: "dppSalesGrowthPct", t: "일평당매출 성장율", align: "r" }
  ];
  function subTable(row, firstLabel) {
    var wrap = el("div");
    var sc = el("div"); sc.style.overflowX = "auto";
    var t = el("table", "subtbl");
    var th = el("thead"), htr = el("tr");
    SUB.forEach(function (c, i) {
      if (c.k === "key") { /* 첫 열 라벨은 호출자가 정함 */ }
      var cell = el("th", c.align === "r" ? "r" : null,
        (c.k === "key" ? firstLabel : c.t) + (subSort === c.k ? (subDir === "asc" ? " ▲" : " ▼") : ""));
      cell.addEventListener("click", function () {
        if (subSort === c.k) subDir = subDir === "asc" ? "desc" : "asc";
        else { subSort = c.k; subDir = c.k === "key" ? "asc" : "desc"; }
        render();
      });
      htr.appendChild(cell);
      if (i === 1 && showAvg) {
        var avg = el("th", "r", "월평균(백만)");
        htr.appendChild(avg);
      }
    });
    th.appendChild(htr); t.appendChild(th);

    var dir = subDir === "asc" ? 1 : -1;
    var all = row.bySub.slice().sort(function (a, b) {
      return subSort === "key" ? a.key.localeCompare(b.key, "ko") * dir : (a[subSort] - b[subSort]) * dir;
    });
    var lim = subLimit[row.key] || 10;
    var shown = all.slice(0, lim);
    var tb = el("tbody");
    shown.forEach(function (s) {
      var tr = el("tr");
      if (s.closed) tr.style.opacity = ".6";
      var k = el("td", "b");
      k.appendChild(document.createTextNode(s.key));
      if (s.closed) k.appendChild(el("span", "tag", "퇴점"));
      tr.appendChild(k);
      tr.appendChild(el("td", "r num b", s.closed ? "—" : mil(s.s)));
      if (showAvg) tr.appendChild(el("td", "r num mut", s.closed ? "—" : mil(s.s / MC)));
      var gs = el("td", "r num", s.ps === 0 ? "—" : milSigned(s.growthS));
      gs.style.color = s.ps === 0 ? "var(--new)" : s.growthS >= 0 ? "var(--up)" : "var(--down)";
      tr.appendChild(gs);
      var gp = el("td", "r"); gp.appendChild(yoyCell(s.growthPct, s.ps, s.closed)); tr.appendChild(gp);
      tr.appendChild(el("td", "r num", s.closed ? "—" : mil(s.g)));
      var gg = el("td", "r num", s.pg === 0 ? "—" : milSigned(s.growthG));
      gg.style.color = s.pg === 0 ? "var(--new)" : s.growthG >= 0 ? "var(--up)" : "var(--down)";
      tr.appendChild(gg);
      var ggp = el("td", "r"); ggp.appendChild(yoyCell(s.growthGPct, s.pg, s.closed)); tr.appendChild(ggp);
      tr.appendChild(el("td", "r num mut", s.area ? s.area + "평" : "—"));
      tr.appendChild(el("td", "r num mut", s.dppSales ? won(s.dppSales) : "—"));
      var dg = el("td", "r"); dg.appendChild(yoyCell(s.dppSalesGrowthPct, s.prevDppSales, s.closed)); tr.appendChild(dg);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    sc.appendChild(t);
    wrap.appendChild(el("div", "cap", firstLabel + "별 상세 (" + all.length + ")"));
    wrap.appendChild(sc);
    if (all.length > shown.length) {
      var mb = el("button", "submore", "더 보기 (+10) · " + shown.length + "/" + all.length);
      mb.addEventListener("click", function (e) {
        e.stopPropagation();
        subLimit[row.key] = lim + 10;
        render();
      });
      wrap.appendChild(mb);
    }
    return wrap;
  }

  // ── 메인 렌더 ────────────────────────────────────────
  function render() {
    renderChips(); renderCards(); renderHead();
    var list = mainRows();
    var tb = document.getElementById("tb");
    tb.textContent = "";
    var shown = list.slice(0, limit);
    document.getElementById("hint").textContent =
      q ? (list.length + "개 검색됨" + (view === "brand" ? " (요약은 선택 칩 기준)" : "")) : (list.length + "개");

    if (!list.length) {
      var tr0 = el("tr"), td0 = el("td", "empty", "데이터 없음");
      td0.colSpan = HEAD.length + 1; tr0.appendChild(td0); tb.appendChild(tr0);
    }
    shown.forEach(function (r, i) {
      var isOpen = openKey === r.key;
      var tr = el("tr", "main" + (isOpen ? " open" : "") + (r.closed ? " closed" : ""));
      var rk = el("td", "num mut");
      rk.appendChild(el("span", null, r.closed ? "  " : isOpen ? "▼ " : "▶ "));
      rk.appendChild(document.createTextNode(String(i + 1)));
      tr.appendChild(rk);
      var k = el("td", "b");
      k.appendChild(document.createTextNode(r.key));
      if (r.closed) k.appendChild(el("span", "tag", "퇴점"));
      tr.appendChild(k);
      tr.appendChild(el("td", "r num mut", r.subCount));
      tr.appendChild(el("td", "r num b", r.closed ? "—" : mil(r.s)));
      tr.appendChild(el("td", "r num", r.closed ? "—" : mil(r.g)));
      tr.appendChild(el("td", "r num mut", r.closed ? "—" : r.gpm + "%"));
      tr.appendChild(el("td", "r num mut", r.closed || !r.dppSales ? "—" : won(r.dppSales)));
      var d1 = el("td", "r"); d1.appendChild(yoyCell(r.dppSalesGrowthPct, r.prevDppSales, r.closed)); tr.appendChild(d1);
      var d2 = el("td", "r"); d2.appendChild(yoyCell(r.yoyPct, r.ps, r.closed)); tr.appendChild(d2);
      if (!r.closed) tr.addEventListener("click", function () { openKey = isOpen ? null : r.key; render(); });
      tb.appendChild(tr);

      if (isOpen && r.bySub.length) {
        var str = el("tr", "subwrap"), std = el("td");
        std.colSpan = HEAD.length + 1;
        std.appendChild(subTable(r, view === "brand" ? "지점" : "브랜드"));
        str.appendChild(std); tb.appendChild(str);
      }
    });

    var more = document.getElementById("more");
    if (list.length > shown.length) {
      var step = view === "brand" ? 20 : 10;
      more.style.display = "";
      more.textContent = "더 보기 (+" + step + ") · " + shown.length + "/" + list.length;
      more.onclick = function () { limit += step; render(); };
    } else {
      more.style.display = "none";
    }
  }

  function reset() { openKey = null; limit = view === "brand" ? 20 : 10; subLimit = {}; render(); }

  document.getElementById("vBrand").addEventListener("click", function () {
    view = "brand";
    this.className = "pill on"; document.getElementById("vStore").className = "pill";
    sortKey = "s"; sortDir = "desc"; q = ""; document.getElementById("q").value = "";
    reset();
  });
  document.getElementById("vStore").addEventListener("click", function () {
    view = "store";
    this.className = "pill on"; document.getElementById("vBrand").className = "pill";
    sortKey = "s"; sortDir = "desc"; q = ""; document.getElementById("q").value = "";
    reset();
  });
  document.getElementById("q").addEventListener("input", function () { q = this.value.trim(); openKey = null; limit = view === "brand" ? 20 : 10; render(); });
  document.getElementById("vStore").textContent = "지점별 (" + D.storeCount + ")";

  document.getElementById("footNote").textContent =
    D.periodLabel + " 실적 · 전년 동기 " + D.prevLabel + " 대비 · 금액 단위 백만원(요약 카드는 억원). " +
    "일평당매출 = 매출 ÷ (전용면적 × 일수), 성장율은 면적 변화가 제거된 좌판효율 변화. " +
    "이 파일은 " + new Date(D.generatedAt).toLocaleString("ko-KR") + " 시점의 스냅샷이며, 화면의 🔍 진단 패널은 포함하지 않습니다.";

  render();
})();
</script>
</body>
</html>`;
}
