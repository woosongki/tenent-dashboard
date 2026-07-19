"use client";

import { useMemo } from "react";
import type { LifestyleReport, LifestyleStoreLine } from "@/lib/sales/lifestyleReport";

const eok = (n: number) => (n / 1e8).toFixed(1);            // 억 (1자리)
const eokS = (n: number) => `${n >= 0 ? "+" : ""}${(n / 1e8).toFixed(1)}`;
const mil = (n: number) => Math.round(n / 1e6).toLocaleString("ko-KR"); // 백만
const won = (n: number) => Math.round(n).toLocaleString("ko-KR");
const pctS = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
const KIND_LABEL: Record<LifestyleStoreLine["kind"], string> = { existing: "기존", new: "신규", closed: "퇴점" };

export default function LifestyleReportTab({ report }: { report: LifestyleReport | null }) {
  const html = useMemo(() => (report ? buildStandaloneHtml(report) : ""), [report]);

  if (!report) {
    return (
      <div className="border-[2px] border-dashed border-slate-300 p-10 text-center text-[13px] text-slate-400">
        라이프스타일(기타) 부문 당월 데이터가 없습니다.
      </div>
    );
  }
  const { totals: t, decomposition: d } = report;

  function download() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `라이프스타일_실적리포트_${report!.curLabel}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* 헤더 + 내보내기 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-extrabold text-[#0a0a0a]">라이프스타일 부문 실적 리포트 · 당월</h3>
          <p className="text-[11px] font-bold text-[#0a0a0a]/55">
            {report.prevLabel} → {report.curLabel} · {report.days}일 동일기간 비교 · 일평당매출 = 매출 ÷ (면적 × {report.days})
          </p>
        </div>
        <button
          onClick={download}
          className="border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-1.5 text-[12px] font-extrabold shadow-[2px_2px_0_0_#0a0a0a] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          ⬇ HTML 내보내기
        </button>
      </div>

      {/* 반박 콜아웃 — 성장의 질 */}
      <div className="border-[3px] border-[#0a0a0a] bg-yellow-100 p-4 shadow-[4px_4px_0_0_#0a0a0a]">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/70">성장의 질 — 면적 효과 vs 좌판효율</p>
        <p className="mt-1.5 text-[13.5px] font-bold text-[#0a0a0a] leading-relaxed">
          매출 <b>{eokS(t.salesDelta)}억</b>({pctS(t.salesGrowthPct)}) 증가 중 —
          신규출점 <b>{eokS(d.newStore)}억</b> · 기존점 면적확대 <b>{eokS(d.existingArea)}억</b> ·{" "}
          <span className="bg-yellow-300 px-1">기존점 좌판효율 {eokS(d.existingEff)}억</span>
          {d.closedStore ? ` · 퇴점 ${eokS(d.closedStore)}억` : ""}.
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-[#0a0a0a]/75">
          기존점({d.existingCount}곳) 일평당매출 <b>{pctS(d.existingDppGrowthPct)}</b> 성장 — 면적 확대와 무관한 질적 성장.
          {d.existingEff > 0 && t.salesDelta > 0 && ` 전체 증가의 ${Math.round((d.existingEff / t.salesDelta) * 100)}%가 좌판효율 기여.`}
        </p>
      </div>

      {/* KPI 3장 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi title="매출" cur={`${eok(t.salesCur)}억`} prev={`${eok(t.salesPrev)}억`} pct={t.salesGrowthPct} />
        <Kpi title="전용면적" cur={`${t.areaCur.toLocaleString()}평`} prev={`${t.areaPrev.toLocaleString()}평`} pct={t.areaGrowthPct} sub={`${t.areaDelta >= 0 ? "+" : ""}${t.areaDelta.toLocaleString()}평`} />
        <Kpi title={`일평당매출 (원/평·일)`} cur={won(t.dppCur)} prev={won(t.dppPrev)} pct={t.dppGrowthPct} highlight />
      </div>

      {/* 성장 분해 막대 */}
      <Waterfall d={d} />

      {/* 지점별 표 */}
      <div className="overflow-x-auto border-[2px] border-[#0a0a0a]">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead className="bg-[#0a0a0a] text-white">
            <tr>
              <th className="px-3 py-2 text-left">지점</th>
              <th className="px-2 py-2 text-center">구분</th>
              <th className="px-2 py-2 text-right">면적(전→당)</th>
              <th className="px-2 py-2 text-right">면적증감</th>
              <th className="px-2 py-2 text-right">일평당(전→당)</th>
              <th className="px-2 py-2 text-right">일평당증감</th>
              <th className="px-2 py-2 text-right">매출(백만)</th>
              <th className="px-2 py-2 text-right">면적효과</th>
              <th className="px-2 py-2 text-right">효율효과</th>
            </tr>
          </thead>
          <tbody>
            {report.stores.map((s) => (
              <tr key={s.store} className={`border-b border-slate-100 ${s.kind === "closed" ? "opacity-55" : ""}`}>
                <td className="px-3 py-1.5 font-bold text-[#0a0a0a] whitespace-nowrap">{s.store}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`border-[1.5px] border-[#0a0a0a] px-1 py-0 text-[9px] font-extrabold ${s.kind === "new" ? "bg-cyan-300" : s.kind === "closed" ? "bg-rose-200" : "bg-white"}`}>{KIND_LABEL[s.kind]}</span>
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-slate-600 whitespace-nowrap">{s.areaPrev.toLocaleString()}→{s.areaCur.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right font-mono" style={{ color: s.areaDelta > 0 ? "#0d9e6e" : s.areaDelta < 0 ? "#e53e3e" : "#94a3b8" }}>{s.areaDelta > 0 ? "+" : ""}{s.areaDelta.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right font-mono text-slate-600 whitespace-nowrap">{won(s.dppPrev)}→{won(s.dppCur)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold" style={{ color: s.kind === "new" ? "#7c3aed" : s.dppGrowthPct >= 0 ? "#0d9e6e" : "#e53e3e" }}>{s.kind === "new" ? "신규" : pctS(s.dppGrowthPct)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold">{mil(s.salesCur)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-slate-500">{s.kind === "existing" ? mil(s.areaEffect) : "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono" style={{ color: s.kind !== "existing" ? "#94a3b8" : s.effEffect >= 0 ? "#0d9e6e" : "#e53e3e" }}>{s.kind === "existing" ? mil(s.effEffect) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] font-medium text-[#0a0a0a]/55">
        면적효과 = (당기−전기 면적) × 평균 평당매출 · 효율효과 = 평균 면적 × (당기−전기 평당매출) — 대칭(Shapley) 분해라 합은 정확히 매출 증감과 일치.
        신규점은 전년 기준이 없어 매출 전액을 신규 기여로 집계. 금액 단위: 억/백만.
      </p>
    </div>
  );
}

function Kpi({ title, cur, prev, pct, sub, highlight }: { title: string; cur: string; prev: string; pct: number; sub?: string; highlight?: boolean }) {
  const up = pct >= 0;
  return (
    <div className={`border-[2px] border-[#0a0a0a] px-4 py-3 shadow-[3px_3px_0_0_#0a0a0a] ${highlight ? "bg-yellow-50" : "bg-white"}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a]/60">{title}</p>
      <p className="mt-1 font-mono text-[22px] font-extrabold tabular-nums text-[#0a0a0a]">{cur}</p>
      <p className="mt-0.5 text-[11px] font-bold text-[#0a0a0a]/55">
        전년 {prev} <span style={{ color: up ? "#0d9e6e" : "#e53e3e" }} className="font-extrabold">({pctS(pct)})</span>
        {sub ? <span className="ml-1 text-[#0a0a0a]/45">{sub}</span> : null}
      </p>
    </div>
  );
}

function Waterfall({ d }: { d: LifestyleReport["decomposition"] }) {
  const parts = [
    { label: "신규출점", v: d.newStore, color: "#22d3ee" },
    { label: "기존점 면적확대", v: d.existingArea, color: "#a78bfa" },
    { label: "기존점 좌판효율", v: d.existingEff, color: "#facc15" },
    ...(d.closedStore ? [{ label: "퇴점", v: d.closedStore, color: "#fda4af" }] : []),
  ];
  const max = Math.max(1, ...parts.map((p) => Math.abs(p.v)));
  return (
    <div className="border-[2px] border-[#0a0a0a] bg-white p-4 shadow-[3px_3px_0_0_#0a0a0a]">
      <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/65">매출 증감 분해 (총 {eokS(d.total)}억)</p>
      <div className="space-y-2">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[11px] font-bold text-[#0a0a0a]/70">{p.label}</span>
            <div className="relative h-4 flex-1 border-[1.5px] border-[#0a0a0a] bg-white">
              <div className="absolute inset-y-0 left-0" style={{ width: `${(Math.abs(p.v) / max) * 100}%`, background: p.color }} />
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-[11.5px] font-extrabold tabular-nums text-[#0a0a0a]">{eokS(p.v)}억</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 단독 HTML 내보내기 (자체 완결 · 임원 보고/공유용) ──
function buildStandaloneHtml(r: LifestyleReport): string {
  const t = r.totals, d = r.decomposition;
  const rows = r.stores.map((s) => `
    <tr class="${s.kind === "closed" ? "dim" : ""}">
      <td class="l"><b>${esc(s.store)}</b></td>
      <td class="c"><span class="tag ${s.kind}">${KIND_LABEL[s.kind]}</span></td>
      <td class="r">${s.areaPrev.toLocaleString()}→${s.areaCur.toLocaleString()}</td>
      <td class="r ${s.areaDelta >= 0 ? "up" : "dn"}">${s.areaDelta >= 0 ? "+" : ""}${s.areaDelta.toLocaleString()}</td>
      <td class="r">${won(s.dppPrev)}→${won(s.dppCur)}</td>
      <td class="r ${s.kind === "new" ? "" : s.dppGrowthPct >= 0 ? "up" : "dn"}"><b>${s.kind === "new" ? "신규" : pctS(s.dppGrowthPct)}</b></td>
      <td class="r"><b>${mil(s.salesCur)}</b></td>
      <td class="r">${s.kind === "existing" ? mil(s.areaEffect) : "—"}</td>
      <td class="r ${s.kind === "existing" && s.effEffect >= 0 ? "up" : s.kind === "existing" ? "dn" : ""}">${s.kind === "existing" ? mil(s.effEffect) : "—"}</td>
    </tr>`).join("");
  const bars = [
    ["신규출점", d.newStore, "#22d3ee"], ["기존점 면적확대", d.existingArea, "#a78bfa"],
    ["기존점 좌판효율", d.existingEff, "#facc15"], ...(d.closedStore ? [["퇴점", d.closedStore, "#fda4af"]] : []),
  ] as [string, number, string][];
  const bmax = Math.max(1, ...bars.map((b) => Math.abs(b[1])));
  const barHtml = bars.map(([l, v, c]) => `
    <div class="bar"><span class="bl">${l}</span><div class="bt"><i style="width:${(Math.abs(v) / bmax) * 100}%;background:${c}"></i></div><span class="bv">${eokS(v)}억</span></div>`).join("");

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>라이프스타일 실적 리포트 ${esc(r.curLabel)}</title>
<style>
*{box-sizing:border-box} body{margin:0;background:#FAF7EC;color:#0a0a0a;font-family:-apple-system,'Malgun Gothic',sans-serif;padding:28px;font-size:13px}
.wrap{max-width:960px;margin:0 auto}
h1{font-size:20px;margin:0 0 2px} .sub{color:#0a0a0a99;font-weight:700;font-size:12px;margin:0 0 18px}
.callout{border:3px solid #0a0a0a;background:#fef9c3;padding:16px;box-shadow:5px 5px 0 #0a0a0a;margin-bottom:18px}
.callout .h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#0a0a0a99}
.callout p{margin:6px 0 0;font-size:14px;font-weight:700;line-height:1.5} .hl{background:#fde047;padding:0 3px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
.kpi{border:2px solid #0a0a0a;background:#fff;padding:12px 14px;box-shadow:3px 3px 0 #0a0a0a}
.kpi .t{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#0a0a0a99}
.kpi .v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;margin:4px 0 2px}
.kpi .p{font-size:11px;font-weight:700;color:#0a0a0a88}
.panel{border:2px solid #0a0a0a;background:#fff;padding:14px;box-shadow:3px 3px 0 #0a0a0a;margin-bottom:18px}
.panel .h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#0a0a0a99;margin-bottom:10px}
.bar{display:flex;align-items:center;gap:8px;margin:6px 0} .bl{width:120px;font-size:11px;font-weight:700;color:#0a0a0abb}
.bt{position:relative;height:16px;flex:1;border:1.5px solid #0a0a0a;background:#fff} .bt i{position:absolute;left:0;top:0;bottom:0;display:block}
.bv{width:80px;text-align:right;font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;border:2px solid #0a0a0a;background:#fff;font-size:12px}
th{background:#0a0a0a;color:#fff;padding:7px 8px;text-align:right;font-weight:700;white-space:nowrap} th:first-child{text-align:left}
td{padding:5px 8px;border-bottom:1px solid #eee;font-variant-numeric:tabular-nums} td.l{text-align:left} td.c{text-align:center} td.r{text-align:right;font-family:ui-monospace,monospace}
.up{color:#0d9e6e} .dn{color:#e53e3e} tr.dim{opacity:.55}
.tag{border:1.5px solid #0a0a0a;padding:0 4px;font-size:9px;font-weight:800} .tag.new{background:#a5f3fc} .tag.closed{background:#fecdd3}
.foot{color:#0a0a0a88;font-size:10px;margin-top:12px;line-height:1.5}
@media print{body{background:#fff}}
</style></head><body><div class="wrap">
<h1>라이프스타일 부문 실적 리포트 · 당월</h1>
<p class="sub">${esc(r.prevLabel)} → ${esc(r.curLabel)} · ${r.days}일 동일기간 비교 · 일평당매출 = 매출 ÷ (면적 × ${r.days})</p>
<div class="callout"><div class="h">성장의 질 — 면적 효과 vs 좌판효율</div>
<p>매출 <b>${eokS(t.salesDelta)}억</b>(${pctS(t.salesGrowthPct)}) 증가 중 — 신규출점 <b>${eokS(d.newStore)}억</b> · 기존점 면적확대 <b>${eokS(d.existingArea)}억</b> · <span class="hl">기존점 좌판효율 ${eokS(d.existingEff)}억</span>${d.closedStore ? ` · 퇴점 ${eokS(d.closedStore)}억` : ""}.</p>
<p>기존점(${d.existingCount}곳) 일평당매출 <b>${pctS(d.existingDppGrowthPct)}</b> 성장 — 면적 확대와 무관한 질적 성장.${d.existingEff > 0 && t.salesDelta > 0 ? ` 전체 증가의 ${Math.round((d.existingEff / t.salesDelta) * 100)}%가 좌판효율 기여.` : ""}</p></div>
<div class="kpis">
<div class="kpi"><div class="t">매출</div><div class="v">${eok(t.salesCur)}억</div><div class="p">전년 ${eok(t.salesPrev)}억 (${pctS(t.salesGrowthPct)})</div></div>
<div class="kpi"><div class="t">전용면적</div><div class="v">${t.areaCur.toLocaleString()}평</div><div class="p">전년 ${t.areaPrev.toLocaleString()}평 (${pctS(t.areaGrowthPct)})</div></div>
<div class="kpi"><div class="t">일평당매출 (원/평·일)</div><div class="v">${won(t.dppCur)}</div><div class="p">전년 ${won(t.dppPrev)} (${pctS(t.dppGrowthPct)})</div></div>
</div>
<div class="panel"><div class="h">매출 증감 분해 (총 ${eokS(d.total)}억)</div>${barHtml}</div>
<table><thead><tr><th>지점</th><th>구분</th><th>면적(전→당)</th><th>면적증감</th><th>일평당(전→당)</th><th>일평당증감</th><th>매출(백만)</th><th>면적효과</th><th>효율효과</th></tr></thead><tbody>${rows}</tbody></table>
<p class="foot">면적효과 = (당기−전기 면적) × 평균 평당매출 · 효율효과 = 평균 면적 × (당기−전기 평당매출) — 대칭(Shapley) 분해로 합은 매출 증감과 일치. 신규점은 전년 기준이 없어 매출 전액을 신규 기여로 집계.<br>생성: ${new Date().toLocaleString("ko-KR")} · lifestyle 대시보드</p>
</div></body></html>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
