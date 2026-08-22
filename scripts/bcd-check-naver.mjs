// BCD 네이버 수집 진단 — 다이소로 C5(데이터랩)·C4(검색광고)가 실제로 나오는지 확인.
// 원격 환경은 외부 API 프록시 403이라 여기서 못 돌린다. 로컬에서:
//   node --env-file=.env.local scripts/bcd-check-naver.mjs
//   (또는 NAVER_SEARCH_CLIENT_ID=.. NAVER_SEARCH_CLIENT_SECRET=.. node scripts/bcd-check-naver.mjs)
import crypto from "node:crypto";

const BRAND = "다이소";
const KW = [BRAND];

// ── C5: 데이터랩 검색어트렌드(전년 동월 대비) ──────────────────────────────
const cid = process.env.NAVER_SEARCH_CLIENT_ID, csec = process.env.NAVER_SEARCH_CLIENT_SECRET;
console.log("데이터랩 키:", cid ? "있음" : "❌없음", "/", csec ? "있음" : "❌없음");
if (cid && csec) {
  const end = new Date(); const start = new Date(); start.setMonth(end.getMonth() - 13);
  const body = { startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10),
                 timeUnit: "month", keywordGroups: [{ groupName: KW[0], keywords: KW.slice(0,5) }] };
  const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
    method: "POST",
    headers: { "X-Naver-Client-Id": cid, "X-Naver-Client-Secret": csec, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("\n[데이터랩] HTTP", res.status);
  if (!res.ok) {
    console.error("  ↳ 오류:", (await res.text()).slice(0, 300));
    console.error("  → 401/403이면 앱에 '데이터랩(검색어트렌드)' scope 미추가일 가능성. 네이버개발자센터에서 API 설정 확인.");
  } else {
    const data = await res.json();
    const series = (data.results?.[0]?.data ?? []).map(p => [p.period.slice(0,7), p.ratio]);
    console.log("  시계열", series.length, "개월:", series.map(([m,r]) => `${m}:${r}`).join(" "));
    const nowYm = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,"0")}`;
    const map = new Map(series);
    const months = [...map.keys()].filter(m => m < nowYm).sort();
    if (!months.length) { console.log("  C5 = N/A (완결월 없음)"); }
    else {
      const latest = months[months.length-1];
      const [ly, lm] = latest.split("-").map(Number);
      const prevKey = `${ly-1}-${String(lm).padStart(2,"0")}`;
      const cur = map.get(latest) ?? 0, prev = map.get(prevKey);
      console.log(`  기준월 ${latest}=${cur} vs 전년 ${prevKey}=${prev ?? "없음"}`);
      if (prev === undefined || prev <= 0) console.log("  C5 = N/A (전년 동월 데이터 없음 → 시계열부족)");
      else console.log(`  ✅ C5 = ${Math.round(((cur/prev-1)*100)*10)/10}%  ← 이 값이 채워집니다`);
    }
  }
} else {
  console.log("→ 데이터랩 키가 없어 C5는 계속 N/A. Vercel/.env.local에 NAVER_SEARCH_CLIENT_ID/SECRET 설정 필요.");
}

// ── C4: 검색광고 keywordstool(절대 검색수) ─────────────────────────────────
const ak = process.env.NAVER_AD_API_KEY, sk = process.env.NAVER_AD_SECRET_KEY, cust = process.env.NAVER_AD_CUSTOMER_ID;
console.log("\n검색광고 키:", ak ? "있음":"❌없음","/",sk?"있음":"❌없음","/",cust?"있음":"❌없음");
if (ak && sk && cust) {
  const ts = String(Date.now()), path = "/keywordstool";
  const sig = crypto.createHmac("sha256", sk).update(`${ts}.GET.${path}`).digest("base64");
  const url = `https://api.searchad.naver.com${path}?hintKeywords=${encodeURIComponent(KW.join(","))}&showDetail=1`;
  const res = await fetch(url, { headers: { "X-Timestamp": ts, "X-API-KEY": ak, "X-Customer": cust, "X-Signature": sig } });
  console.log("[검색광고] HTTP", res.status);
  if (!res.ok) console.error("  ↳ 오류:", (await res.text()).slice(0,200));
  else {
    const list = (await res.json()).keywordList ?? [];
    const row = list.find(r => (r.relKeyword||"").replace(/\s/g,"").toLowerCase() === BRAND);
    const pc = Number(String(row?.monthlyPcQcCnt).replace(/[^0-9]/g,""))||0;
    const mo = Number(String(row?.monthlyMobileQcCnt).replace(/[^0-9]/g,""))||0;
    console.log(`  ✅ C4 = ${pc+mo} (PC ${pc} + 모바일 ${mo})`);
  }
}
