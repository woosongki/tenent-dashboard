#!/usr/bin/env node
/**
 * 오프라인 매출분석(누적·당월·상세)을 단독 인터랙티브 HTML 1개로 내보내기.
 *
 * - Supabase에서 sales_offline_cum / sales_offline_month 를 직접 읽어
 *   앱(src/lib/sales/queries.ts)의 aggregate/buildOff 로직을 그대로 포팅해 집계.
 * - 결과 데이터를 HTML에 JSON으로 박제 + 바닐라 JS로 탭/정렬/드릴다운 동작.
 *   → 로그인·서버 없이 파일만 열면 동작. 데이터는 내보낸 시점으로 고정(스냅샷).
 *
 * 실행: node scripts/export-offline-html.mjs
 * 출력: 매출분석_오프라인.html (프로젝트 루트)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

config({ path: ".env.local", override: true });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const OFFLINE_DIVISIONS = ["패션", "F&B", "기타"];

// ── 라벨 (src/lib/sales/labels.ts 포팅) ──────────────────────────
const DIVISION_LABEL = { 기타: "라이프스타일" };
const DIVISION_ORDER = ["패션", "F&B", "기타"];
const HIDDEN_CATS = new Set(["패션공통"]);
const CAT_LABEL = {
  "잡화(특정매입)": "트렌드(잡화)", "영캐쥬얼(특정)2001": "영캐주얼",
  "여성의류(특정)NC": "여성", "남성의류(특정매입)": "신사",
  "스포츠(특정)NC": "스포츠", "캐쥬얼(특정매입)": "캐주얼", "아동의류(특정매입)": "아동",
};
const CAT_ORDER = ["잡화(특정매입)", "영캐쥬얼(특정)2001", "여성의류(특정)NC",
  "남성의류(특정매입)", "스포츠(특정)NC", "캐쥬얼(특정매입)", "아동의류(특정매입)"];
const displayDivision = (d) => DIVISION_LABEL[d] ?? d;
const divisionRank = (d) => { const i = DIVISION_ORDER.indexOf(d); return i < 0 ? 999 : i; };
const isHiddenCat = (c) => !!c && HIDDEN_CATS.has(c);
const displayCat = (c) => (c ? (CAT_LABEL[c] ?? c) : "");
const catRank = (c) => { if (!c) return 999; const i = CAT_ORDER.indexOf(c); return i < 0 ? 998 : i; };

const OTHERS_KEY = "그외", OTHERS_LABEL = "그 외";
const OTHERS_EXACT = new Set(["엠페스트", "코코몽키즈랜드", "이키즈랜드"]);
const isOthersBrand = (brand) => {
  if (!brand) return false;
  const b = brand.trim();
  if (OTHERS_EXACT.has(b)) return true;
  if (b.startsWith("문화센터")) return true;
  if (b.startsWith("소극장(")) return true;
  return false;
};

function cumDays(year, monthYm) {
  const y = Number(year);
  if (!monthYm || Number.isNaN(y)) return 181;
  const m = Number(String(monthYm).replace(/[^0-9]/g, "").slice(4, 6));
  if (!m) return 181;
  const end = new Date(y, m, 0), start = new Date(y, 0, 1);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

// ── 데이터 로드 (queries.ts fetchOff 포팅: 안정 정렬 + 페이징) ────
async function fetchOff(table, col, periods) {
  const all = [];
  let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from(table).select(`division,cat,brand,store,sales,gp,area_raw,store_cnt,${col}`).in(col, periods)
      .order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data ?? []).map((r) => ({ ...r, p: r[col] })));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── 집계 (queries.ts aggregate/buildOff 포팅) ────────────────────
function aggregate(filtered, cur, prev, days) {
  const growthDpp = (dpp, pdpp) => pdpp ? +((dpp - pdpp) / pdpp * 100).toFixed(1) : 0;
  function rank(keyOf, withCat, subOf, labelOf) {
    const c = new Map(), p = new Map();
    const subEnsure = (m, sk) => { let e = m.get(sk); if (!e) { e = { s: 0, g: 0, ps: 0, pg: 0, area: 0, parea: 0, cnt: 0 }; m.set(sk, e); } return e; };
    for (const r of filtered) {
      const k = keyOf(r);
      if (r.p === cur) {
        const e = c.get(k) ?? { s: 0, g: 0, area: 0, parea: 0, label: labelOf ? labelOf(r) : k, cat: r.cat, division: r.division, sub: new Map() };
        e.s += r.sales; e.g += r.gp; e.area += r.area_raw;
        if (subOf) { const se = subEnsure(e.sub, subOf(r)); se.s += r.sales; se.g += r.gp; se.area += r.area_raw; se.cnt += r.store_cnt; }
        c.set(k, e);
      } else if (r.p === prev) {
        const e = p.get(k) ?? { s: 0, g: 0, area: 0, label: labelOf ? labelOf(r) : k, cat: r.cat, division: r.division };
        e.s += r.sales; e.g += r.gp; e.area += r.area_raw;
        p.set(k, e);
      }
    }
    for (const [k, pv] of p) { const e = c.get(k); if (e) e.parea += pv.area; }
    for (const r of filtered) {
      if (r.p !== prev || !subOf) continue;
      const e = c.get(keyOf(r)); if (!e) continue;
      const se = subEnsure(e.sub, subOf(r)); se.ps += r.sales; se.pg += r.gp; se.parea += r.area_raw;
    }
    const out = [];
    for (const [k, e] of c) {
      const pv = p.get(k) ?? { s: 0, g: 0, area: 0 };
      const dppSales = e.area ? Math.round(e.s / e.area) : 0;
      const prevDppSales = e.parea ? Math.round(pv.s / e.parea) : 0;
      out.push({
        key: e.label, cat: withCat ? e.cat : undefined, division: withCat ? e.division : undefined,
        s: e.s, ps: pv.s, g: e.g, pg: pv.g,
        gpm: e.s ? +(e.g / e.s * 100).toFixed(1) : 0,
        yoyPct: pv.s ? +((e.s - pv.s) / pv.s * 100).toFixed(1) : 0,
        subCount: [...e.sub.values()].filter((v) => v.s > 0).length,
        dppSales, prevDppSales, dppSalesGrowthPct: growthDpp(dppSales, prevDppSales),
        bySub: subOf ? [...e.sub.entries()].map(([key, v]) => {
          const dpp = v.area ? Math.round(v.s / v.area) : 0;
          const pdpp = v.parea ? Math.round(v.ps / v.parea) : 0;
          return {
            key, s: v.s, ps: v.ps, g: v.g, pg: v.pg,
            growthS: v.s - v.ps, growthPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0,
            growthG: v.g - v.pg, growthGPct: v.pg ? +((v.g - v.pg) / v.pg * 100).toFixed(1) : 0,
            area: days ? Math.round(v.area / days) : 0,
            dppSales: dpp, prevDppSales: pdpp, dppSalesGrowthPct: growthDpp(dpp, pdpp),
            storeCnt: v.cnt, closed: v.s === 0 && v.ps > 0,
          };
        }).sort((a, b) => b.s - a.s).slice(0, 50) : undefined,
      });
    }
    for (const [k, pv] of p) {
      if (c.has(k)) continue;
      out.push({
        key: pv.label, cat: withCat ? pv.cat : undefined, division: withCat ? pv.division : undefined,
        s: 0, ps: pv.s, g: 0, pg: pv.g, gpm: 0, yoyPct: -100, subCount: 0,
        dppSales: 0,
        prevDppSales: pv.area ? Math.round(pv.s / pv.area) : 0,
        dppSalesGrowthPct: -100,
        closed: true, bySub: subOf ? [] : undefined,
      });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  const divMap = new Map();
  for (const r of filtered) {
    const e = divMap.get(r.division) ?? { s: 0, ps: 0, g: 0, pg: 0 };
    if (r.p === cur) { e.s += r.sales; e.g += r.gp; } else if (r.p === prev) { e.ps += r.sales; e.pg += r.gp; }
    divMap.set(r.division, e);
  }
  const fashMap = new Map();
  for (const r of filtered) {
    if (r.division !== "패션") continue;
    const e = fashMap.get(r.cat) ?? { s: 0, ps: 0, g: 0, pg: 0 };
    if (r.p === cur) { e.s += r.sales; e.g += r.gp; } else if (r.p === prev) { e.ps += r.sales; e.pg += r.gp; }
    fashMap.set(r.cat, e);
  }
  const total = filtered.filter((r) => r.p === cur).reduce((t, r) => t + r.sales, 0);
  const prevTotal = filtered.filter((r) => r.p === prev).reduce((t, r) => t + r.sales, 0);
  const gTotal = filtered.filter((r) => r.p === cur).reduce((t, r) => t + r.gp, 0);
  return {
    total, prevTotal, gTotal,
    gpm: total ? +(gTotal / total * 100).toFixed(1) : 0,
    yoyPct: prevTotal ? +((total - prevTotal) / prevTotal * 100).toFixed(1) : 0,
    brands: rank((r) => r.brand, true, (r) => r.store),
    stores: rank((r) => r.store, false, (r) => r.brand),
    detailBrands: rank((r) => `${r.division}|${r.cat}|${r.brand}`, true, (r) => r.store, (r) => r.brand),
    divisions: [...divMap.entries()].map(([division, v]) => ({
      division, label: displayDivision(division), s: v.s, ps: v.ps, g: v.g,
      gpm: v.s ? +(v.g / v.s * 100).toFixed(1) : 0, yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0,
    })).sort((a, b) => b.s - a.s),
    fashionCats: [...fashMap.entries()].map(([cat, v]) => ({
      cat, label: displayCat(cat), s: v.s, ps: v.ps, g: v.g,
      gpm: v.s ? +(v.g / v.s * 100).toFixed(1) : 0, yoyPct: v.ps ? +((v.s - v.ps) / v.ps * 100).toFixed(1) : 0,
    })).sort((a, b) => b.s - a.s),
  };
}

function buildOff(rows, cur, prev, divisions, days) {
  const filtered = divisions ? rows.filter((r) => divisions.includes(r.division)) : rows;
  const main = aggregate(filtered.filter((r) => !isOthersBrand(r.brand)), cur, prev, days);
  const oth = aggregate(filtered.filter((r) => isOthersBrand(r.brand)), cur, prev, days);
  return {
    ...main,
    others: {
      total: oth.total, prevTotal: oth.prevTotal, gTotal: oth.gTotal, gpm: oth.gpm, yoyPct: oth.yoyPct,
      brands: oth.brands, stores: oth.stores, detailBrands: oth.detailBrands,
    },
  };
}

// 상세 탭 칩 목록 (복종 + 부문 + 그외)
function buildChips(period) {
  const fashion = period.fashionCats.filter((c) => !isHiddenCat(c.cat))
    .sort((a, b) => catRank(a.cat) - catRank(b.cat))
    .map((c) => ({ type: "cat", key: c.cat, label: c.label || "(미분류)", s: c.s }));
  const divs = period.divisions.filter((d) => d.division !== "패션")
    .sort((a, b) => divisionRank(a.division) - divisionRank(b.division))
    .map((d) => ({ type: "div", key: d.division, label: d.label, s: d.s }));
  const others = period.others.brands.length
    ? [{ type: "div", key: OTHERS_KEY, label: OTHERS_LABEL, s: period.others.total }] : [];
  return [...fashion, ...divs, ...others];
}

// ── 실행 ────────────────────────────────────────────────────────
async function main() {
  console.log("· 기간 메타 조회…");
  const [{ data: cy }, { data: my }] = await Promise.all([
    supabase.from("sales_offline_cum").select("year").order("year", { ascending: false }).limit(1),
    supabase.from("sales_offline_month").select("ym").order("ym", { ascending: false }).limit(1),
  ]);
  const cumYear = cy?.[0]?.year ?? null;
  const monthYm = my?.[0]?.ym ?? null;
  if (!cumYear && !monthYm) { console.error("❌ 오프라인 데이터 없음"); process.exit(1); }

  let offCum = null, offMonth = null;
  if (cumYear) {
    const py = String(Number(cumYear) - 1);
    console.log(`· 누적 ${cumYear} vs ${py} 집계…`);
    const rows = await fetchOff("sales_offline_cum", "year", [cumYear, py]);
    offCum = { year: cumYear, prevYear: py, periodLabel: `${cumYear} 누적`, prevLabel: `${py} 누적`,
      ...buildOff(rows, cumYear, py, OFFLINE_DIVISIONS, cumDays(cumYear, monthYm)) };
  }
  if (monthYm) {
    const pym = `${Number(String(monthYm).slice(0, 4)) - 1}${String(monthYm).slice(4)}`;
    console.log(`· 당월 ${monthYm} vs ${pym} 집계…`);
    const rows = await fetchOff("sales_offline_month", "ym", [monthYm, pym]);
    offMonth = { ym: monthYm, prevYm: pym, periodLabel: monthYm, prevLabel: pym,
      ...buildOff(rows, monthYm, pym, OFFLINE_DIVISIONS, 30) };
  }

  const data = {
    generatedAt: new Date().toISOString(),
    cumYear, monthYm,
    cum: offCum ? { ...offCum, chips: buildChips(offCum) } : null,
    month: offMonth ? { ...offMonth, chips: buildChips(offMonth) } : null,
  };

  const outPath = path.join(ROOT, "매출분석_오프라인.html");
  writeFileSync(outPath, renderHtml(data), "utf8");
  console.log(`✅ 생성: ${outPath}`);
  console.log(`   누적 ${cumYear ?? "-"} · 당월 ${monthYm ?? "-"} · 브랜드 ${offCum?.brands.length ?? 0}개 · 지점 ${offCum?.stores.length ?? 0}개`);
}

function renderHtml(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>오프라인 매출분석 — ${data.cumYear ?? ""} 누적 / ${data.monthYm ?? ""} 당월</title>
<style>${CSS}</style></head>
<body>
<header>
  <div class="wrap">
    <div class="eyebrow">SALES ANALYTICS · 오프라인 스냅샷</div>
    <h1>매출분석 (오프라인)</h1>
    <div class="meta" id="meta"></div>
  </div>
</header>
<main class="wrap">
  <nav class="tabs" id="tabs">
    <button data-tab="cum" class="on">누적</button>
    <button data-tab="month">당월</button>
    <button data-tab="detail">상세</button>
  </nav>
  <section id="view"></section>
  <footer>Supabase 스냅샷 · 내보낸 시각 <span id="gen"></span> · 데이터는 이 시점으로 고정됩니다 · 단위 표기: 억/백만원</footer>
</main>
<script>const DATA = ${json};</script>
<script>${JS}</script>
</body></html>`;
}

// ── HTML 자산 (CSS / JS) ────────────────────────────────────────
const CSS = `
:root{--ink:#0a0a0a;--bg:#FAF7EC;--card:#fff;--up:#0d9e6e;--down:#e53e3e;--accent:#db2777}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,'Segoe UI','Malgun Gothic',sans-serif;background:var(--bg);color:var(--ink)}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px}
header{background:var(--ink);color:#fff;padding:20px 0 18px;border-bottom:3px solid var(--ink)}
.eyebrow{font-size:10px;font-weight:800;letter-spacing:.18em;color:#facc15}
h1{margin:.2em 0 .1em;font-size:26px}
.meta{font-size:12px;color:#cbd5e1}
.tabs{display:flex;gap:8px;margin:18px 0}
.tabs button{border:2px solid var(--ink);background:#fff;padding:8px 16px;font-weight:800;font-size:13px;cursor:pointer}
.tabs button.on{background:var(--ink);color:#fff;box-shadow:2px 2px 0 0 var(--ink)}
section#view{padding-bottom:40px}
.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
@media(min-width:720px){.kpis{grid-template-columns:repeat(5,1fr)}}
.kpi{border:2px solid var(--ink);background:var(--card);padding:12px;overflow:hidden}
.kpi .l{font-size:10px;font-weight:800;letter-spacing:.12em;color:#64748b;text-transform:uppercase}
.kpi .v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;margin-top:6px}
.kpi .s{font-size:11px;color:#64748b;margin-top:2px}
.up{color:var(--up)}.down{color:var(--down)}
h3{font-size:13px;font-weight:800;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.08em}
.tablewrap{border:2px solid var(--ink);background:#fff;overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:520px;font-size:12px}
thead{background:var(--ink);color:#fff}
th,td{padding:7px 10px;text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
th.sortable{cursor:pointer;user-select:none}th.sortable:hover{background:#222}
tbody tr{border-top:1px solid #e2e8f0}
tbody tr.brand{cursor:pointer}tbody tr.brand:hover{background:#fef9c3}
tbody tr.open{background:#fef9c3}
.mono{font-variant-numeric:tabular-nums}
.badge{display:inline-block;border:1px solid;padding:0 4px;font-size:9px;font-weight:800;margin-left:4px;vertical-align:middle}
.b-new{border-color:#7c3aed;color:#7c3aed}.b-closed{border-color:var(--down);color:var(--down)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.chips button{border:2px solid var(--ink);background:#fff;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer}
.chips button.on{color:#fff}
.sub{background:#f8fafc}
.sub table{min-width:680px;font-size:11px}
.sub thead{background:#475569}
.muted{color:#94a3b8}
.toggle{display:flex;gap:6px;margin:10px 0}
.toggle button{border:2px solid var(--ink);background:#fff;padding:5px 12px;font-weight:700;font-size:12px;cursor:pointer}
.toggle button.on{background:var(--ink);color:#fff}
footer{margin-top:30px;padding:14px 0;border-top:2px solid var(--ink);font-size:10px;font-weight:700;letter-spacing:.04em;color:#64748b;text-transform:uppercase}
.empty{padding:30px;text-align:center;color:#94a3b8}
`;

const JS = `
const won=n=>Math.round(n).toLocaleString('ko-KR');
const eok=n=>(n/1e8).toFixed(1);
const mil=n=>Math.round(n/1e6).toLocaleString('ko-KR');
const milS=n=>(n>=0?'+':'')+Math.round(n/1e6).toLocaleString('ko-KR');
const pct=n=>(n>=0?'+':'')+n.toFixed(1)+'%';
const el=(h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

document.getElementById('gen').textContent=new Date(DATA.generatedAt).toLocaleString('ko-KR');
document.getElementById('meta').textContent=
  '누적 '+(DATA.cumYear??'-')+' · 당월 '+(DATA.monthYm??'-')+
  (DATA.cum?(' · 브랜드 '+DATA.cum.brands.length+'개 · 지점 '+DATA.cum.stores.length+'개'):'');

let tab='cum';
const view=document.getElementById('view');
document.getElementById('tabs').addEventListener('click',e=>{
  const b=e.target.closest('button[data-tab]'); if(!b)return;
  tab=b.dataset.tab;
  [...e.currentTarget.children].forEach(x=>x.classList.toggle('on',x===b));
  render();
});

function yoyCell(r){
  if(r.closed)return '<td class="down">퇴점</td>';
  if(r.ps===0)return '<td style="color:#7c3aed">신규</td>';
  const u=r.yoyPct>=0;return '<td class="mono '+(u?'up':'down')+'">'+(u?'▲':'▼')+' '+Math.abs(r.yoyPct).toFixed(1)+'%</td>';
}

function kpis(p){
  return '<div class="kpis">'+
    card('총매출',eok(p.total)+'억',won(p.total)+'원')+
    card('전년('+esc(p.prevLabel)+')',eok(p.prevTotal)+'억','')+
    card('전년대비',pct(p.yoyPct),'',p.yoyPct>=0?'up':'down')+
    card('이익률',p.gpm+'%',won(p.gTotal)+'원 이익')+
    card('브랜드 / 지점',p.brands.filter(b=>!b.closed).length+' / '+p.stores.filter(s=>!s.closed).length,'개')+
    '</div>';
}
function card(l,v,s,cls){return '<div class="kpi"><div class="l">'+l+'</div><div class="v '+(cls||'')+'">'+v+'</div>'+(s?'<div class="s">'+s+'</div>':'')+'</div>';}

function divTable(p){
  let h='<h3>부문별</h3><div class="tablewrap"><table><thead><tr><th>부문</th><th>매출(백만)</th><th>전년</th><th>이익률</th><th>전년비</th></tr></thead><tbody>';
  for(const d of p.divisions)h+='<tr><td>'+esc(d.label)+'</td><td class="mono">'+mil(d.s)+'</td><td class="mono muted">'+mil(d.ps)+'</td><td class="mono">'+d.gpm+'%</td>'+yoyCell({yoyPct:d.yoyPct,ps:d.ps})+'</tr>';
  h+='</tbody></table></div>';
  if(p.fashionCats.length){
    h+='<h3>복종별 (패션)</h3><div class="tablewrap"><table><thead><tr><th>복종</th><th>매출(백만)</th><th>전년</th><th>이익률</th><th>전년비</th></tr></thead><tbody>';
    for(const c of p.fashionCats){if(c.label==='패션공통'||c.cat==='패션공통')continue;
      h+='<tr><td>'+esc(c.label||c.cat)+'</td><td class="mono">'+mil(c.s)+'</td><td class="mono muted">'+mil(c.ps)+'</td><td class="mono">'+c.gpm+'%</td>'+yoyCell({yoyPct:c.yoyPct,ps:c.ps})+'</tr>';}
    h+='</tbody></table></div>';
  }
  return h;
}

let rankSort={key:'s',dir:-1};
function rankTable(list,sortable){
  const rows=[...list].sort((a,b)=>{const k=rankSort.key;const av=k==='key'?a.key:a[k];const bv=k==='key'?b.key:b[k];
    return (typeof av==='string'?String(av).localeCompare(bv,'ko'):av-bv)*rankSort.dir;});
  const ar=k=>rankSort.key===k?(rankSort.dir<0?' ▼':' ▲'):'';
  let h='<div class="tablewrap"><table><thead><tr><th>#</th>'+
    th('브랜드','key')+th('매장수','subCount')+th('매출(백만)','s')+th('이익(백만)','g')+th('이익률','gpm')+th('전년비','yoyPct')+
    '</tr></thead><tbody>';
  rows.forEach((r,i)=>{h+='<tr><td class="muted">'+(i+1)+'</td><td>'+esc(r.key)+(r.closed?'<span class="badge b-closed">퇴점</span>':r.ps===0?'<span class="badge b-new">신규</span>':'')+
    '</td><td class="mono muted">'+r.subCount+'</td><td class="mono">'+(r.closed?'—':mil(r.s))+'</td><td class="mono">'+(r.closed?'—':mil(r.g))+'</td><td class="mono muted">'+(r.closed?'—':r.gpm+'%')+'</td>'+yoyCell(r)+'</tr>';});
  h+='</tbody></table></div>';
  function th(label,key){return '<th class="sortable" data-sort="'+key+'">'+label+ar(key)+'</th>';}
  return h;
}

function bindSort(container){
  container.querySelectorAll('th[data-sort]').forEach(t=>t.addEventListener('click',()=>{
    const k=t.dataset.sort;
    if(rankSort.key===k)rankSort.dir*=-1;else{rankSort={key:k,dir:k==='key'?1:-1};}
    render();
  }));
}

function periodView(p){
  let h=kpis(p)+divTable(p)+'<h3>브랜드 랭킹</h3>'+rankTable(p.brands,true);
  if(p.others&&p.others.brands.length){
    h+='<h3>그 외 ('+p.others.brands.length+'개 · 본 수치 제외)</h3>'+
      '<div class="kpis"><div class="kpi"><div class="l">그 외 매출</div><div class="v">'+eok(p.others.total)+'억</div></div>'+
      '<div class="kpi"><div class="l">전년대비</div><div class="v '+(p.others.yoyPct>=0?'up':'down')+'">'+pct(p.others.yoyPct)+'</div></div></div>';
  }
  return h;
}

// 상세 탭 상태
let detailPeriod='cum', detailView='brand', detailChip=null, detailOpen=null;
function detailViewHtml(){
  const p=detailPeriod==='cum'?DATA.cum:DATA.month;
  if(!p)return '<div class="empty">데이터 없음</div>';
  const chips=p.chips;
  if(!detailChip&&chips.length)detailChip=chips[0];
  let h='<div class="toggle">'+
    pbtn('cum','누적',detailPeriod==='cum',DATA.cum)+pbtn('month','당월',detailPeriod==='month',DATA.month)+
    '<span style="width:14px"></span>'+
    vbtn('brand','브랜드별')+vbtn('store','지점별')+'</div>';
  if(detailView==='brand'){
    h+='<div class="chips">'+chips.map(c=>'<button data-chip="'+esc(c.type+'|'+c.key)+'" class="'+(detailChip&&detailChip.type===c.type&&detailChip.key===c.key?'on':'')+'" style="'+(detailChip&&detailChip.type===c.type&&detailChip.key===c.key?(c.type==='cat'?'background:#db2777;color:#fff':'background:#7c3aed;color:#fff'):'')+'">'+esc(c.label)+' <span class="muted" style="font-size:10px">'+eok(c.s)+'억</span></button>').join('')+'</div>';
    h+=detailBrandTable(p);
  } else {
    h+=detailStoreTable(p);
  }
  return h;
  function pbtn(k,l,on,avail){return avail?'<button data-dp="'+k+'" class="'+(on?'on':'')+'">'+l+'</button>':'';}
  function vbtn(k,l){return '<button data-dv="'+k+'" class="'+(detailView===k?'on':'')+'">'+l+'</button>';}
}
function rowsForChip(p){
  const c=detailChip; if(!c)return [];
  if(c.type==='div'&&c.key==='${OTHERS_KEY}')return p.others.detailBrands;
  return p.detailBrands.filter(b=>c.type==='cat'?(b.division==='패션'&&b.cat===c.key):b.division===c.key);
}
function detailBrandTable(p){
  const rows=[...rowsForChip(p)].sort((a,b)=>b.s-a.s);
  if(!rows.length)return '<div class="empty">데이터 없음</div>';
  let h='<div class="tablewrap"><table><thead><tr><th>#</th><th>브랜드</th><th>지점수</th><th>매출(백만)</th><th>이익(백만)</th><th>이익률</th><th>전년비</th></tr></thead><tbody>';
  rows.forEach((r,i)=>{const id='b'+i;const open=detailOpen===id;
    h+='<tr class="brand '+(open?'open':'')+'" data-row="'+id+'"><td class="muted">'+(open?'▼':'▶')+' '+(i+1)+'</td><td>'+esc(r.key)+(r.closed?'<span class="badge b-closed">퇴점</span>':r.ps===0?'<span class="badge b-new">신규</span>':'')+'</td><td class="mono muted">'+r.subCount+'</td><td class="mono">'+(r.closed?'—':mil(r.s))+'</td><td class="mono">'+(r.closed?'—':mil(r.g))+'</td><td class="mono muted">'+(r.closed?'—':r.gpm+'%')+'</td>'+yoyCell(r)+'</tr>';
    if(open)h+=subRow(r,'지점');
  });
  h+='</tbody></table></div>';return h;
}
function detailStoreTable(p){
  const rows=[...p.stores].sort((a,b)=>b.s-a.s);
  if(!rows.length)return '<div class="empty">데이터 없음</div>';
  let h='<div class="tablewrap"><table><thead><tr><th>#</th><th>지점</th><th>브랜드수</th><th>매출(백만)</th><th>이익(백만)</th><th>이익률</th><th>전년비</th></tr></thead><tbody>';
  rows.forEach((r,i)=>{const id='s'+i;const open=detailOpen===id;
    h+='<tr class="brand '+(open?'open':'')+'" data-row="'+id+'"><td class="muted">'+(open?'▼':'▶')+' '+(i+1)+'</td><td>'+esc(r.key)+(r.closed?'<span class="badge b-closed">퇴점</span>':'')+'</td><td class="mono muted">'+r.subCount+'</td><td class="mono">'+(r.closed?'—':mil(r.s))+'</td><td class="mono">'+(r.closed?'—':mil(r.g))+'</td><td class="mono muted">'+(r.closed?'—':r.gpm+'%')+'</td>'+yoyCell(r)+'</tr>';
    if(open)h+=subRow(r,'브랜드');
  });
  h+='</tbody></table></div>';return h;
}
function subRow(r,label){
  const subs=(r.bySub||[]).filter(s=>s.s>0||s.closed);
  if(!subs.length)return '<tr class="sub"><td></td><td colspan="6" class="muted" style="padding:10px">하위 데이터 없음</td></tr>';
  let h='<tr class="sub"><td></td><td colspan="6" style="padding:0"><div class="tablewrap" style="border:0"><table><thead><tr><th>'+label+'</th><th>매출(백만)</th><th>전년</th><th>성장률</th><th>이익(백만)</th><th>이익률</th><th>일평당(원)</th></tr></thead><tbody>';
  for(const s of subs){const gp=s.s?(s.g/s.s*100).toFixed(1):'0';
    h+='<tr><td>'+esc(s.key)+(s.closed?'<span class="badge b-closed">퇴점</span>':s.ps===0?'<span class="badge b-new">신규</span>':'')+'</td><td class="mono">'+(s.closed?'—':mil(s.s))+'</td><td class="mono muted">'+mil(s.ps)+'</td>'+yoyCell({yoyPct:s.growthPct,ps:s.ps,closed:s.closed})+'<td class="mono">'+(s.closed?'—':mil(s.g))+'</td><td class="mono muted">'+(s.closed?'—':gp+'%')+'</td><td class="mono muted">'+(s.dppSales?won(s.dppSales):'—')+'</td></tr>';}
  h+='</tbody></table></div></td></tr>';return h;
}

function render(){
  if(tab==='cum'||tab==='month'){
    const p=tab==='cum'?DATA.cum:DATA.month;
    view.innerHTML=p?periodView(p):'<div class="empty">데이터 없음</div>';
    if(p)bindSort(view);
  } else {
    view.innerHTML=detailViewHtml();
    view.querySelectorAll('[data-dp]').forEach(b=>b.onclick=()=>{detailPeriod=b.dataset.dp;detailChip=null;detailOpen=null;render();});
    view.querySelectorAll('[data-dv]').forEach(b=>b.onclick=()=>{detailView=b.dataset.dv;detailOpen=null;render();});
    view.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{const[t,k]=b.dataset.chip.split('|');detailChip={type:t,key:k};detailOpen=null;render();});
    view.querySelectorAll('tr.brand[data-row]').forEach(tr=>tr.onclick=()=>{const id=tr.dataset.row;detailOpen=detailOpen===id?null:id;render();});
  }
}
render();
`;

main().catch((e) => { console.error("❌", e); process.exit(1); });
