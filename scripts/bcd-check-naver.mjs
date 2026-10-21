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
  // 프로덕션과 동일: 기준월 = 직전 완결월, 비교월 = 그 전년 동월 (둘 다 완전한 달)
  const now = new Date();
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const refY = ref.getUTCFullYear(), refM = ref.getUTCMonth();
  const mm = String(refM + 1).padStart(2, "0");
  const refYm = `${refY}-${mm}`, prevYm = `${refY - 1}-${mm}`;
  const startDate = `${prevYm}-01`;
  const endDate = new Date(Date.UTC(refY, refM + 1, 0)).toISOString().slice(0, 10);
  console.log(`  조회 ${startDate} ~ ${endDate} | 기준월 ${refYm} vs 전년동월 ${prevYm}`);
  const body = { startDate, endDate, timeUnit: "month",
                 keywordGroups: [{ groupName: KW[0], keywords: KW.slice(0,5) }] };
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
    const map = new Map(series);
    const cur = map.get(refYm), prev = map.get(prevYm);
    console.log(`  기준월 ${refYm}=${cur ?? "없음"} vs 전년동월 ${prevYm}=${prev ?? "없음"}`);
    if (cur === undefined) console.log("  C5 = N/A (기준월 데이터 없음 — 검색량이 매우 적은 키워드)");
    else if (prev === undefined || prev <= 0) console.log("  C5 = N/A (전년 동월 0 또는 없음 → 시계열부족)");
    else console.log(`  ✅ C5 = ${Math.round(((cur/prev-1)*100)*10)/10}%  ← 이 값이 채워집니다`);
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
