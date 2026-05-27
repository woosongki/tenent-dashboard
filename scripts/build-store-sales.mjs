#!/usr/bin/env node
/**
 * ERP 4월 한달 회원구매·객단가 데이터를
 * → src/data/store-sales.json 저장
 * → src/data/eland-meta.ts의 tenant_mix.price_band 자동 채움
 *
 * 실행: node scripts/build-store-sales.mjs
 */

import { writeFileSync, readFileSync } from "fs";

const PERIOD = "2026-04";

// ── 원본 데이터 (사용자 ERP 추출) ─────────────────────────────────
const raw = `7204\t중계점\t5,857,393,701\t29,679\t197,358\t30\t107,010\t54,737
7206\t안양점\t1,158,413,191\t10,168\t113,927\t30\t18,905\t61,275
7209\t분당점\t8,986,714,018\t42,873\t209,612\t26\t171,711\t52,336
7214\t해운대점\t4,720,960,171\t28,535\t165,445\t30\t104,699\t45,091
7215\t천호2점\t1,958,199,865\t12,783\t153,188\t30\t29,217\t67,023
7216\t부평점\t1,334,066,607\t9,479\t140,739\t30\t22,608\t59,009
7217\t불광점\t11,221,598,323\t51,460\t218,064\t30\t210,406\t53,333
7219\t고잔점\t8,236,985,303\t35,987\t228,888\t30\t134,363\t61,304
7305\tNC포항점\t358,809,956\t2,441\t146,993\t30\t5,660\t63,394
7916\t신정킴스\t98,657,908\t2,196\t44,926\t28\t8,159\t12,092
7917\t신촌킴스\t85,636,174\t1,966\t43,559\t28\t7,266\t11,786
7918\t염창킴스\t86,774,947\t1,699\t51,074\t28\t6,829\t12,707
7920\t김포킴스\t319,289,662\t2,984\t107,001\t28\t14,484\t22,044
7921\t구의킴스\t697,047,781\t9,362\t74,455\t28\t29,752\t23,429
8201\t일산점\t8,477,525,964\t39,368\t215,341\t30\t151,080\t56,113
8202\t야탑점\t14,157,289,566\t61,845\t228,916\t30\t248,636\t56,940
8203\t인천점\t6,451,027,241\t36,111\t178,644\t30\t112,845\t57,167
8204\t평택점\t2,798,817,615\t13,653\t204,997\t30\t37,408\t74,819
8205\t평촌2점\t11,187,668,275\t62,004\t180,435\t30\t216,239\t51,738
8206\t강남점\t18,291,560,453\t57,817\t316,370\t30\t271,761\t67,308
8208\t동수원\t6,252,003,323\t30,089\t207,784\t30\t107,351\t58,239
8212\t순천점\t3,995,154,858\t12,643\t315,997\t30\t34,235\t116,698
8215\t산본점\t3,271,664,170\t25,656\t127,520\t30\t80,883\t40,449
8216\t울산점\t768,033,300\t5,303\t144,830\t30\t12,436\t61,759
8217\t광명점\t2,601,897,433\t18,642\t139,572\t30\t74,533\t34,909
8218\t괴정점\t4,265,889,991\t23,522\t181,357\t30\t79,652\t53,557
8219\t울산2점\t346,095,946\t3,162\t109,455\t30\t5,731\t60,390
8220\t창원점\t3,571,984,084\t17,546\t203,578\t30\t49,905\t71,576
8222\t부천점\t12,272,664,040\t62,013\t197,905\t30\t228,469\t53,717
8223\t덕천점\t3,610,950,193\t21,193\t170,384\t30\t52,724\t68,488
8224\t송파점\t11,305,215,389\t59,979\t188,486\t30\t213,479\t52,957
8227\t강서점\t15,036,347,183\t61,647\t243,910\t30\t244,559\t61,484
8228\t충장점\t2,444,873,790\t14,279\t171,222\t30\t38,626\t63,296
8229\t부산대점\t4,325,665,187\t27,991\t154,538\t30\t90,653\t47,717
8230\t전주점\t465,486,600\t3,246\t143,403\t30\t6,146\t75,738
8231\t엑스코점\t2,294,950,312\t10,737\t213,742\t30\t27,641\t83,027
8233\t광주역점\t774,873,131\t4,227\t183,315\t30\t10,416\t74,393
8235\t중앙로역점\t1,790,158,450\t11,082\t161,537\t30\t25,018\t71,555
8237\t수원터미널점\t3,869,602,162\t19,976\t193,713\t30\t53,675\t72,093
8239\t경산점\t1,089,206,300\t7,828\t139,142\t30\t18,451\t59,032
8241\t청주점\t2,513,075,602\t14,890\t168,776\t30\t44,913\t55,954
8242\t신구로점\t6,971,379,875\t36,201\t192,574\t30\t140,979\t49,450
8243\t대전유성점\t6,694,958,937\t32,130\t208,371\t30\t101,991\t65,643
8501\t쇼핑점\t6,208,510,159\t40,491\t153,331\t30\t125,227\t49,578
8502\t수성점\t3,469,197,206\t17,224\t201,416\t30\t74,537\t46,543
8503\t구미점\t1,406,074,411\t4,840\t290,511\t30\t10,935\t128,585
8504\t강북점\t1,476,552,660\t8,542\t172,858\t30\t19,277\t76,597`;

// ── 객단가 → price_band 매핑 ──────────────────────────────────
// brand-fit AgeBand 타입: "초저가" | "중저가" | "중가" | "중고가" | "고가"
function inferPriceBand(unitPrice) {
  if (unitPrice < 50_000) return "초저가";
  if (unitPrice < 100_000) return "중저가";
  if (unitPrice < 200_000) return "중가";
  if (unitPrice < 300_000) return "중고가";
  return "고가";
}

// 1. 파싱
const stores = raw.split("\n").map((line) => {
  const parts = line.split("\t");
  const code = parts[0];
  const name = parts[1];
  const nums = parts.slice(2).map((s) => Number(s.replace(/,/g, "")));
  return {
    storeCode: code,
    storeName: name,
    revenueWon: nums[0],
    customers: nums[1],
    avgPricePerCustomer: nums[2],
    operatingDays: nums[3],
    receipts: nums[4],
    avgPricePerReceipt: nums[5],
    priceBand: inferPriceBand(nums[2]),
  };
});

// 2. ELAND_STORES 매칭 (41개점만)
const homeplusContent = readFileSync("src/data/homeplus.ts", "utf-8");
const match = homeplusContent.match(/export const ELAND_STORES[^=]*=\s*(\[[\s\S]*?\n\]);/);
const elandStores = eval(match[1]);

function normalize(s) {
  return s.replace(/^NC/, "").replace(/점$/, "").replace(/\s+/g, "");
}
const nameToId = new Map();
elandStores.forEach((s) => nameToId.set(normalize(s.name), s.id));

const allEnriched = stores.map((st) => ({
  storeId: nameToId.get(normalize(st.storeName)) ?? null,
  ...st,
}));

// 41점 마스터에 없는 점포(킴스클럽·NC포항)는 제외
const enriched = allEnriched.filter((s) => s.storeId !== null);
const excluded = allEnriched.filter((s) => s.storeId === null);
const matched = enriched;
console.log(`41점 마스터 매칭: ${matched.length} / 41`);
if (excluded.length > 0) {
  console.log(`제외된 ${excluded.length}개점 (마스터에 없음):`);
  excluded.forEach((s) => console.log(`  ${s.storeCode} ${s.storeName}`));
}

// 3. JSON 저장
const out = {
  $schema: "./store-sales.schema.json",
  version: "1.0",
  compiledAt: new Date().toISOString().slice(0, 10),
  period: PERIOD,
  source: "ERP 4월 한달 회원구매·객단가",
  priceBandRules: {
    "초저가": "< 50,000원",
    "중저가": "50,000~99,999원",
    "중가": "100,000~199,999원",
    "중고가": "200,000~299,999원",
    "고가": "300,000원+",
  },
  grandTotal: {
    revenueWon: enriched.reduce((s, x) => s + x.revenueWon, 0),
    customers: enriched.reduce((s, x) => s + x.customers, 0),
    receipts: enriched.reduce((s, x) => s + x.receipts, 0),
  },
  stores: enriched,
};
writeFileSync("src/data/store-sales.json", JSON.stringify(out, null, 2));
console.log(`✅ src/data/store-sales.json 저장`);
console.log(`   총 매출: ${Math.round(out.grandTotal.revenueWon / 1e8).toLocaleString()}억 (${PERIOD})`);
console.log(`   총 고객: ${out.grandTotal.customers.toLocaleString()}`);
console.log(`   총 영수증: ${out.grandTotal.receipts.toLocaleString()}`);

// 4. eland-meta.ts에 price_band 자동 채움
const idToPriceBand = new Map();
matched.forEach((s) => idToPriceBand.set(s.storeId, [s.priceBand]));

let metaContent = readFileSync("src/data/eland-meta.ts", "utf-8");
// 기존 line별로 처리: store_id: N, ... price_band: [] → price_band: ["..."]
for (let id = 1; id <= 41; id++) {
  const band = idToPriceBand.get(id);
  if (!band) continue;
  const newBand = `price_band: ${JSON.stringify(band)} as PriceBand[]`;
  const storeIdLine = `store_id: ${id},`;
  // store_id: N으로 시작하는 객체 내에서 price_band: [] 를 교체
  const regex = new RegExp(
    `(store_id: ${id},[\\s\\S]*?price_band: )\\[\\]`,
    "g"
  );
  metaContent = metaContent.replace(regex, `$1${JSON.stringify(band)} as PriceBand[]`);
}

writeFileSync("src/data/eland-meta.ts", metaContent);
console.log("✅ src/data/eland-meta.ts price_band 자동 채움 완료");

// 5. price_band 분포 출력
const dist = {};
matched.forEach((s) => {
  dist[s.priceBand] = (dist[s.priceBand] || 0) + 1;
});
console.log("\n📊 price_band 분포 (41개점):");
["고가", "중고가", "중가", "중저가", "초저가"].forEach((b) => {
  if (dist[b]) console.log(`   ${b}: ${dist[b]}개점`);
});
