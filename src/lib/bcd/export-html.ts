// 브랜드컨셉등급(BCD) 탭 → 단독 HTML 파일 1개로 내보내기.
// 목적: 로그인·네트워크 없이 열어보고 공유할 수 있는 스냅샷(검색·필터·정렬·펼침 유지).
// 원칙:
//   - 점수는 여기서 다시 계산하지 않는다. 서버 채점 결과(ScoreResult)를 그대로 심는다.
//   - 외부 CDN·폰트를 쓰지 않는다(오프라인에서 깨지면 공유 자료로 쓸모가 없다).
//   - 브랜드명 등 데이터는 JSON으로 심고 DOM은 textContent로만 채운다(HTML 주입 차단).

import type { Ruleset, ScoreResult } from "./score";
import { CRITERIA_HELP, GRADE_BAR, GRADE_ORDER, SCOPE_LABEL } from "./display";

export interface ExportBrand {
  id: string;
  name: string;
  category_major: string;
  category_minor: string;
  scope_status: string;
}

export interface BcdExportInput {
  ruleset: Ruleset | null;
  brands: ExportBrand[];
  scores: ScoreResult[];
  /** 생성 시각(ISO). 스냅샷임을 분명히 하기 위해 화면에 박아둔다. */
  generatedAt: string;
}

/** <script> 안에 JSON을 심을 때 조기 종료·주석 주입을 막는다. */
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

export function bcdExportFilename(generatedAt: string): string {
  return `brand-concept-${generatedAt.slice(0, 10)}.html`;
}

export function renderBcdHtml(input: BcdExportInput): string {
  const { ruleset, brands, scores, generatedAt } = input;

  // 지표 코드 → 이름·배점 (펼침 상세 표기용)
  const crit: Record<string, { name: string; weight: number }> = {};
  if (ruleset) {
    for (const c of ruleset.base) crit[c.code] = { name: c.name, weight: c.weight };
    crit[ruleset.bonus.code] = { name: ruleset.bonus.name, weight: ruleset.bonus.weight };
  }

  const scoreById = new Map(scores.map((s) => [s.brandId, s]));
  const rows = brands.map((b) => {
    const s = scoreById.get(b.id) ?? null;
    return {
      id: b.id,
      name: b.name,
      major: b.category_major,
      minor: b.category_minor,
      scope: b.scope_status,
      scopeLabel: b.scope_status === "active" ? null : (SCOPE_LABEL[b.scope_status] ?? b.scope_status),
      grade: s?.grade ?? null,
      total: s?.total ?? null,
      base: s?.baseScore ?? null,
      bonus: s?.bonusScore ?? null,
      naPoints: s?.naPoints ?? null,
      position: s?.searchPosition ?? null,
      breakdown: s
        ? Object.keys(s.breakdown).sort().map((code) => {
            const r = s.breakdown[code];
            return {
              code,
              name: crit[code]?.name ?? "",
              weight: crit[code]?.weight ?? null,
              value: r.value,
              score: r.score,
              rank: r.rank ?? null,
              group: r.comparisonGroup ?? null,
              groupSize: r.comparisonSize ?? null,
            };
          })
        : [],
    };
  });

  const activeCount = brands.filter((b) => b.scope_status === "active").length;
  const topCount = scores.filter((s) => s.grade === "A" || s.grade === "B+").length;
  const unratedCount = scores.filter((s) => s.grade === "미평가").length;
  const distMap = new Map<string, number>();
  for (const s of scores) distMap.set(s.grade, (distMap.get(s.grade) ?? 0) + 1);
  const dist = GRADE_ORDER.map((g) => ({ g, n: distMap.get(g) ?? 0 })).filter((x) => x.n > 0);

  const majors = [...new Set(brands.map((b) => b.category_major).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  const payload = {
    rows,
    dist,
    majors,
    gradeOrder: [...GRADE_ORDER],
    gradeBar: GRADE_BAR,
    cuts: ruleset?.cuts ?? null,
    maxNaPoints: ruleset?.na_policy.max_na_points ?? 25,
    kpi: { brands: brands.length, active: activeCount, scored: scores.length, top: topCount, unrated: unratedCount },
    generatedAt,
    hasRuleset: Boolean(ruleset),
  };

  const stamp = new Date(generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  const helpRows = CRITERIA_HELP.map(
    (c) => `<tr>
      <td class="b nw">${escapeHtml(c.code)} ${escapeHtml(c.title)}</td>
      <td class="mut">${escapeHtml(c.what)}</td>
      <td class="mut">${escapeHtml(c.how)}</td>
      <td class="mut nw">${escapeHtml(c.source)}</td>
    </tr>`
  ).join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>브랜드컨셉등급(BCD) — ${escapeHtml(stamp)} 기준</title>
<style>
  :root { --ink:#0a0a0a; --bg:#FAF7EC; --bg2:#F1ECDB; --mut:#64748b; --line:#e2e8f0; }
  * { box-sizing:border-box; }
  body { margin:0; padding:20px 16px 48px; background:var(--bg); color:var(--ink);
         font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Segoe UI",system-ui,sans-serif;
         font-size:13px; line-height:1.5; }
  .wrap { max-width:1180px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
  .card { border:2px solid var(--ink); background:#fff; box-shadow:3px 3px 0 0 var(--ink); padding:16px; }
  h1 { margin:0; font-size:22px; font-weight:800; letter-spacing:-0.01em; }
  .eyebrow { margin:0 0 4px; font-size:10.5px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:rgba(10,10,10,.6); }
  .sub { margin:8px 0 0; font-size:12px; color:var(--mut); }
  .stamp { display:inline-block; margin-top:10px; border:2px solid var(--ink); background:#fde047; padding:3px 8px;
           font-size:11px; font-weight:800; }
  .kpis { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
  @media (min-width:720px) { .kpis { grid-template-columns:repeat(4,1fr); gap:12px; } }
  .kpi { border:2px solid var(--ink); background:#fff; box-shadow:3px 3px 0 0 var(--ink); padding:12px; }
  .kpi.hl { background:#fde047; }
  .kpi .lbl { font-size:10.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:rgba(10,10,10,.65); }
  .kpi .val { font-size:24px; font-weight:800; font-variant-numeric:tabular-nums;
              font-family:ui-monospace,SFMono-Regular,Menlo,monospace; margin-top:2px; }
  .kpi .sub { font-size:10.5px; color:var(--mut); margin:2px 0 0; }
  .sect-t { margin:0 0 12px; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:rgba(10,10,10,.65); }
  .bars { display:flex; flex-direction:column; gap:8px; }
  .bar-row { display:flex; align-items:center; gap:8px; }
  .bar-track { position:relative; height:16px; flex:1; border:1.5px solid var(--ink); background:#fff; }
  .bar-fill { position:absolute; inset:0 auto 0 0; }
  .bar-n { width:40px; text-align:right; font-family:ui-monospace,Menlo,monospace; font-size:11.5px; font-weight:800; font-variant-numeric:tabular-nums; }
  .chip { display:inline-block; border:1px solid var(--ink); padding:1px 6px; font-size:10px; font-weight:800; background:#fff; }
  .g-A{background:#ede9fe;border-color:#c4b5fd;color:#5b21b6}
  .g-Bp{background:#d1fae5;border-color:#6ee7b7;color:#065f46}
  .g-B{background:#e0f2fe;border-color:#7dd3fc;color:#075985}
  .g-C{background:#fef3c7;border-color:#fcd34d;color:#92400e}
  .g-N{background:#ffe4e6;border-color:#fda4af;color:#9f1239}
  .g-H{background:#1e293b;border-color:#0a0a0a;color:#fff}
  .g-x{background:#f1f5f9;border-color:#cbd5e1;color:#475569}
  table { width:100%; border-collapse:collapse; font-size:12px; }
  .scroll { overflow-x:auto; border:2px solid var(--ink); background:#fff; box-shadow:3px 3px 0 0 var(--ink); }
  thead.dark th { background:var(--ink); color:#fff; font-size:11px; font-weight:800; padding:8px 10px; text-align:left; white-space:nowrap; }
  thead.dark th.s { cursor:pointer; user-select:none; }
  thead.dark th.s:hover { background:#262626; }
  th.r, td.r { text-align:right; }
  th.c, td.c { text-align:center; }
  tbody td { padding:6px 10px; border-top:1px solid var(--line); }
  tbody tr.brand { cursor:pointer; }
  tbody tr.brand:hover { background:#fefce8; }
  tbody tr.brand.open { background:#fef9c3; }
  tbody tr.brand.dim { opacity:.6; }
  .num { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-variant-numeric:tabular-nums; }
  .b { font-weight:700; }
  .nw { white-space:nowrap; }
  .mut { color:var(--mut); }
  .na { color:#e53e3e; }
  .det { background:var(--bg); }
  .det table { min-width:520px; font-size:11px; }
  .det thead th { background:var(--bg2); color:var(--ink); padding:4px 8px; font-weight:800; text-align:left; white-space:nowrap; }
  .det tbody td { padding:4px 8px; border-top:1px solid #cbd5e1; }
  .help table { min-width:720px; font-size:11px; }
  .help thead th { background:var(--ink); color:#fff; padding:6px 8px; text-align:left; }
  .help tbody td { padding:6px 8px; border-top:1px solid var(--line); vertical-align:top; }
  .controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  input[type=search], select { border:2px solid var(--ink); background:#fff; padding:6px 8px; font:inherit; font-size:12px; outline:none; }
  input[type=search] { min-width:200px; }
  button.tog { border:2px solid var(--ink); background:#fff; box-shadow:3px 3px 0 0 var(--ink); padding:6px 12px;
               font:inherit; font-size:12px; font-weight:800; cursor:pointer; }
  button.tog:active { box-shadow:1px 1px 0 0 var(--ink); }
  .foot { font-size:10.5px; color:rgba(10,10,10,.6); }
  .empty { padding:28px; text-align:center; color:#94a3b8; }
</style>
</head>
<body>
<div class="wrap">
  <header class="card">
    <p class="eyebrow">BRAND CONCEPT DEGREE</p>
    <h1>브랜드컨셉등급(BCD)</h1>
    <p class="sub">라이프스타일 부문 브랜드를 8개 지표(C1~C8)로 채점해 A/B+/B/C/N 등급으로 정리. 이 파일은 읽기 전용 스냅샷입니다.</p>
    <span class="stamp">스냅샷 ${escapeHtml(stamp)} (KST)</span>
  </header>

  <div class="kpis" id="kpis"></div>

  <section class="card">
    <p class="sect-t">등급 분포</p>
    <div class="bars" id="bars"></div>
  </section>

  <div>
    <button class="tog" id="helpBtn" type="button">❓ C1~C8 점수 기준 설명</button>
    <div class="card help" id="help" style="display:none;margin-top:8px;padding:4px;overflow-x:auto">
      <table>
        <thead><tr><th>지표</th><th>무엇을 보나</th><th>점수 방식</th><th>출처</th></tr></thead>
        <tbody>${helpRows}</tbody>
      </table>
      <p class="foot" style="padding:6px 8px" id="helpNote"></p>
    </div>
  </div>

  <div class="controls">
    <input type="search" id="q" placeholder="브랜드·분류 검색">
    <select id="major"><option value="">전체 부문</option></select>
    <select id="grade"><option value="">전체 등급</option></select>
    <select id="scope">
      <option value="all">전체 범위</option>
      <option value="active">활성</option>
      <option value="excluded">제외(X)</option>
      <option value="knockout">거래불가(H)</option>
    </select>
    <span class="mut" id="count"></span>
  </div>

  <div class="scroll">
    <table>
      <thead class="dark">
        <tr>
          <th class="s" data-k="name">브랜드</th>
          <th class="s" data-k="category">부문·중분류</th>
          <th class="s c" data-k="grade">등급</th>
          <th class="s r" data-k="total">총점</th>
          <th class="r">기본·가점</th>
          <th class="s r" data-k="naPoints">N/A(점)</th>
          <th class="c">검색포지션</th>
        </tr>
      </thead>
      <tbody id="tb"></tbody>
    </table>
  </div>

  <p class="foot" id="footNote"></p>
</div>

<script type="application/json" id="bcd-data">${embedJson(payload)}</script>
<script>
(function () {
  var D = JSON.parse(document.getElementById("bcd-data").textContent);
  var GCLASS = { "A":"g-A", "B+":"g-Bp", "B":"g-B", "C":"g-C", "N":"g-N", "H":"g-H" };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function gradeChip(g) {
    var n = el("span", "chip " + (GCLASS[g] || "g-x"), g || "—");
    return n;
  }

  // KPI
  var kpis = [
    { lbl:"전체 브랜드", val:D.kpi.brands, sub:"활성 " + D.kpi.active + "개" },
    { lbl:"채점 완료", val:D.kpi.scored, sub:D.hasRuleset ? "활성 기준 적용" : "기준 없음", hl:true },
    { lbl:"A · B+ 등급", val:D.kpi.top, sub:"상위 등급" },
    { lbl:"N/A 초과(미평가)", val:D.kpi.unrated, sub:"지표 결측 과다" }
  ];
  var kw = document.getElementById("kpis");
  kpis.forEach(function (k) {
    var c = el("div", "kpi" + (k.hl ? " hl" : ""));
    c.appendChild(el("div", "lbl", k.lbl));
    c.appendChild(el("div", "val", k.val.toLocaleString()));
    c.appendChild(el("p", "sub", k.sub));
    kw.appendChild(c);
  });

  // 등급 분포
  var bw = document.getElementById("bars");
  var maxN = Math.max.apply(null, [1].concat(D.dist.map(function (d) { return d.n; })));
  D.dist.forEach(function (d) {
    var row = el("div", "bar-row");
    var lead = el("span"); lead.style.width = "56px"; lead.style.flexShrink = "0";
    lead.appendChild(gradeChip(d.g));
    var track = el("div", "bar-track");
    var fill = el("div", "bar-fill");
    fill.style.width = (d.n / maxN * 100) + "%";
    fill.style.background = D.gradeBar[d.g] || "#94a3b8";
    track.appendChild(fill);
    row.appendChild(lead); row.appendChild(track);
    row.appendChild(el("span", "bar-n", d.n));
    bw.appendChild(row);
  });
  if (!D.dist.length) bw.appendChild(el("p", "mut", "채점된 브랜드가 없습니다."));

  // 기준 설명 토글 + 주석
  var cuts = D.cuts ? ("등급컷 A " + D.cuts.A + " · B+ " + D.cuts.Bp + " · B " + D.cuts.B + " · C " + D.cuts.C) : "등급컷 정보 없음";
  document.getElementById("helpNote").textContent =
    "등급 = 8지표 가중합(기본 100점) + C7 가점(최대 5). 결측 배점이 " + D.maxNaPoints + "점 초과면 '미평가'. " + cuts + ".";
  var help = document.getElementById("help"), hb = document.getElementById("helpBtn");
  hb.addEventListener("click", function () {
    var open = help.style.display !== "none";
    help.style.display = open ? "none" : "block";
    hb.textContent = open ? "❓ C1~C8 점수 기준 설명" : "✕ 닫기";
  });

  // 필터 옵션
  var msel = document.getElementById("major");
  D.majors.forEach(function (m) { msel.appendChild(new Option(m, m)); });
  var gsel = document.getElementById("grade");
  D.gradeOrder.forEach(function (g) { gsel.appendChild(new Option(g, g)); });

  var sortKey = "total", dir = "desc", openRow = null;

  function gRank(g) { var i = D.gradeOrder.indexOf(g); return i < 0 ? 99 : i; }

  function visible() {
    var q = document.getElementById("q").value.trim().toLowerCase();
    var mj = msel.value, gd = gsel.value, sc = document.getElementById("scope").value;
    var out = D.rows.filter(function (r) {
      if (sc !== "all" && r.scope !== sc) return false;
      if (mj && r.major !== mj) return false;
      if (gd && r.grade !== gd) return false;
      if (q) {
        var hay = (r.name + " " + r.major + " " + r.minor).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var mul = dir === "asc" ? 1 : -1;
    out.sort(function (a, b) {
      if (sortKey === "name") return a.name.localeCompare(b.name, "ko") * mul;
      if (sortKey === "category") return (a.major + a.minor).localeCompare(b.major + b.minor, "ko") * mul;
      if (sortKey === "grade") return (gRank(a.grade) - gRank(b.grade)) * mul;
      if (sortKey === "naPoints") return ((a.naPoints || 0) - (b.naPoints || 0)) * mul;
      return ((a.total === null ? -1 : a.total) - (b.total === null ? -1 : b.total)) * mul;
    });
    return out;
  }

  function detailTable(r) {
    var wrap = el("div");
    wrap.style.overflowX = "auto";
    if (!r.breakdown.length) {
      wrap.appendChild(el("p", "mut", r.grade === "H" ? "거래불가(H) — 점수 계산 제외." : "채점 상세가 없습니다."));
      return wrap;
    }
    var t = el("table");
    var th = el("thead"), htr = el("tr");
    ["지표", "원값", "점수/배점", "백분위", "비교군"].forEach(function (h, i) {
      var c = el("th", i === 1 || i === 2 || i === 3 ? "r" : null, h);
      htr.appendChild(c);
    });
    th.appendChild(htr); t.appendChild(th);
    var tb = el("tbody");
    r.breakdown.forEach(function (d) {
      var tr = el("tr");
      tr.appendChild(el("td", "b nw", d.code + " " + d.name));
      tr.appendChild(el("td", "r num", d.value === null ? "—" : d.value));
      var isNa = d.score === null;
      tr.appendChild(el("td", "r num" + (isNa ? " na" : ""), isNa ? "N/A" : d.score + "/" + (d.weight === null ? "?" : d.weight)));
      tr.appendChild(el("td", "r num mut", d.rank === null ? "—" : d.rank + "%"));
      tr.appendChild(el("td", "mut nw", d.group ? d.group + " (" + (d.groupSize || 0) + ")" : "—"));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  }

  function render() {
    var list = visible();
    var tb = document.getElementById("tb");
    tb.textContent = "";
    document.getElementById("count").textContent = list.length + " / " + D.rows.length + "개";
    if (!list.length) {
      var tr = el("tr"), td = el("td", "empty", "결과 없음");
      td.colSpan = 7; tr.appendChild(td); tb.appendChild(tr);
      return;
    }
    list.forEach(function (r) {
      var isOpen = openRow === r.id;
      var tr = el("tr", "brand" + (isOpen ? " open" : "") + (r.scope !== "active" ? " dim" : ""));
      var nameTd = el("td", "b nw");
      nameTd.appendChild(el("span", "mut", isOpen ? "▾ " : "▸ "));
      nameTd.appendChild(document.createTextNode(r.name));
      tr.appendChild(nameTd);
      tr.appendChild(el("td", "mut nw", r.major + " · " + r.minor));
      var gtd = el("td", "c");
      if (r.scopeLabel) gtd.appendChild(el("span", "b mut", r.scopeLabel));
      else gtd.appendChild(gradeChip(r.grade || "미평가"));
      tr.appendChild(gtd);
      tr.appendChild(el("td", "r num b", r.total === null ? "—" : r.total));
      tr.appendChild(el("td", "r num mut nw", r.base === null ? "—" : r.base + "·+" + r.bonus));
      var naTd = el("td", "r num", r.naPoints === null ? "—" : r.naPoints);
      naTd.style.color = (r.naPoints || 0) > D.maxNaPoints ? "#e53e3e" : "#94a3b8";
      tr.appendChild(naTd);
      tr.appendChild(el("td", "c b mut", r.position || "—"));
      tr.addEventListener("click", function () { openRow = isOpen ? null : r.id; render(); });
      tb.appendChild(tr);
      if (isOpen) {
        var dtr = el("tr", "det"), dtd = el("td");
        dtd.colSpan = 7;
        dtd.appendChild(detailTable(r));
        dtr.appendChild(dtd); tb.appendChild(dtr);
      }
    });
  }

  ["q", "major", "grade", "scope"].forEach(function (id) {
    var n = document.getElementById(id);
    n.addEventListener(id === "q" ? "input" : "change", function () { openRow = null; render(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll("thead.dark th.s"), function (th) {
    th.addEventListener("click", function () {
      var k = th.getAttribute("data-k");
      if (sortKey === k) dir = dir === "asc" ? "desc" : "asc";
      else { sortKey = k; dir = (k === "name" || k === "category") ? "asc" : "desc"; }
      Array.prototype.forEach.call(document.querySelectorAll("thead.dark th.s"), function (o) {
        o.textContent = o.textContent.replace(/[ ▲▼]+$/, "");
      });
      th.textContent = th.textContent + (dir === "asc" ? " ▲" : " ▼");
      render();
    });
  });

  document.getElementById("footNote").textContent =
    "등급 = 8지표(C1~C8) 가중 채점 → 기본 100점 환산 + 가점(C7) − N/A 정책(결측 " + D.maxNaPoints +
    "점 초과 시 미평가). 이 파일은 " + new Date(D.generatedAt).toLocaleString("ko-KR") +
    " 시점의 스냅샷으로, 이후 수집·채점 변경은 반영되지 않습니다." +
    (D.hasRuleset ? "" : " · 활성 ruleset이 없어 채점이 비어 있습니다.");

  render();
})();
</script>
</body>
</html>`;
}
