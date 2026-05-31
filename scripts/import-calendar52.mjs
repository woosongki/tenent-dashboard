 
// 데스크톱 HTML(이랜드리테일_팝업_52주_캘린더_v4.html)에서 const W=[...]만
// 안전하게 추출해 src/data/calendar52.json 으로 저장.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(homedir(), "Desktop", "이랜드리테일_팝업_52주_캘린더_v4.html");
const OUT = resolve(__dirname, "..", "src", "data", "calendar52.json");
const OUT_SS = resolve(__dirname, "..", "src", "data", "calendar52-seasons.json");

function main() {
  const html = readFileSync(SRC, "utf8");

  // const W=[ ... }]; 추출
  const wStart = html.indexOf("const W=[");
  if (wStart < 0) throw new Error("const W=[ 패턴을 찾지 못했습니다.");
  // W 배열의 끝 `}];` 위치 (가장 가까운 다음 `\n};\n` 또는 `}];\n`)
  let depth = 0, i = wStart + "const W=".length;
  if (html[i] !== "[") throw new Error("배열 시작 [ 누락");
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  const wSrc = html.slice(wStart + "const W=".length, i);

  // SS 시즌 스타일도 추출
  const ssStart = html.indexOf("const SS=");
  let ssData = null;
  if (ssStart >= 0) {
    let j = ssStart + "const SS=".length;
    if (html[j] === "{") {
      let d = 0;
      for (; j < html.length; j++) {
        const c = html[j];
        if (c === "{") d++;
        else if (c === "}") { d--; if (d === 0) { j++; break; } }
      }
      const ssSrc = html.slice(ssStart + "const SS=".length, j);
      ssData = vm.runInNewContext("(" + ssSrc + ")");
    }
  }

  // 안전한 vm 컨텍스트에서 평가 (외부 접근 X). 입력은 신뢰된 로컬 파일.
  const W = vm.runInNewContext(wSrc);
  if (!Array.isArray(W) || W.length !== 52) {
    console.warn(`경고: W.length=${W.length} (52 기대)`);
  }

  // \n 통일: 백틱 문자열은 이미 실제 개행 포함. \\n 형태로 들어왔다면 변환.
  const norm = (s) => String(s ?? "").replace(/\\n/g, "\n");

  const records = W.map((w) => ({
    index:     w.i,
    month:     w.mo,
    season:    w.se,
    monthKw:   norm(w.kw),
    weekNo:    String(w.wk),
    concept:   norm(w.cn),
    grade:     w.gr,             // ★ 표기
    intensity: w.gc,             // high|mid|low
    others:    (w.ou ?? []).map((o) => ({ label: o.l, color: o.c, text: norm(o.t) })),
    extEvents: (w.ex ?? []).map((e) => ({ label: e.l, text: norm(e.t) })),
    popups:    (w.pp ?? []).map((p) => ({ label: p.l, color: p.c, text: norm(p.t) })),
    item:      norm(w.it),
    hotsauce:  norm(w.hs),
    bestCat:   norm(w.bt),
  }));

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      { source: "이랜드리테일_팝업_52주_캘린더_v4.html", importedAt: new Date().toISOString(), count: records.length, records },
      null, 2,
    ),
    "utf8",
  );
  if (ssData) {
    writeFileSync(OUT_SS, JSON.stringify(ssData, null, 2), "utf8");
  }
  console.log(`✓ ${records.length}주 변환 → ${OUT}`);
  if (ssData) console.log(`✓ 시즌 스타일 → ${OUT_SS}`);
}

main();
