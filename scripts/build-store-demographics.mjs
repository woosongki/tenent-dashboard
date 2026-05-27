#!/usr/bin/env node
/**
 * ERP 점포별 연령대별 구매고객수·영수증건수 데이터를
 * → src/data/store-demographics.json 저장
 * → src/data/eland-meta.ts의 trade_area.primary_age 자동 채움
 *
 * 실행: node scripts/build-store-demographics.mjs
 */

import { writeFileSync, readFileSync } from "fs";

// ── 원본 데이터 (사용자 ERP 추출) ─────────────────────────────────
const raw = `7204\t중계점\t29,679\t107,010\t43\t130\t310\t853\t2,135\t6,915\t8,434\t31,923\t10,346\t37,356\t7,856\t28,145\t555\t1,688
7206\t안양점\t10,168\t18,905\t6\t8\t33\t49\t261\t406\t990\t1,657\t2,199\t4,009\t6,554\t12,555\t125\t221
7209\t분당점\t42,873\t171,711\t47\t158\t453\t1,250\t2,448\t7,995\t8,680\t33,490\t13,105\t52,376\t17,545\t74,733\t595\t1,709
7214\t해운대점\t28,535\t104,699\t20\t51\t307\t701\t2,274\t6,958\t6,611\t23,117\t7,963\t28,845\t10,925\t43,840\t435\t1,187
7215\t천호2점\t12,783\t29,217\t13\t30\t141\t240\t986\t1,997\t3,252\t7,719\t3,618\t8,244\t4,439\t10,320\t334\t667
7216\t부평점\t9,479\t22,608\t7\t18\t66\t145\t585\t1,222\t1,532\t3,395\t2,435\t5,689\t4,664\t11,734\t190\t405
7217\t불광점\t51,460\t210,406\t60\t183\t656\t1,856\t3,640\t12,078\t9,057\t33,274\t13,769\t55,483\t23,637\t105,669\t641\t1,863
7219\t고잔점\t35,987\t134,363\t48\t168\t606\t1,635\t4,497\t15,190\t10,259\t40,336\t11,356\t42,468\t8,632\t32,811\t589\t1,755
8201\t일산점\t39,368\t151,080\t53\t172\t452\t1,176\t2,627\t8,212\t8,777\t33,546\t12,145\t46,046\t14,588\t59,789\t726\t2,139
8202\t야탑점\t61,845\t248,636\t72\t270\t713\t1,760\t4,891\t14,482\t13,603\t50,940\t17,449\t69,287\t24,171\t109,190\t946\t2,707
8203\t인천점\t36,111\t112,845\t31\t112\t540\t1,237\t3,244\t8,452\t8,130\t24,564\t10,267\t31,904\t13,143\t44,661\t756\t1,915
8204\t평택점\t13,653\t37,408\t13\t30\t139\t330\t1,293\t3,561\t3,713\t10,468\t3,957\t10,552\t4,246\t11,724\t292\t743
8205\t평촌2점\t62,004\t216,239\t67\t181\t575\t1,322\t4,673\t12,289\t13,382\t43,311\t18,141\t63,810\t24,353\t93,262\t813\t2,064
8206\t강남점\t57,817\t271,761\t66\t303\t416\t1,260\t3,347\t12,117\t11,559\t50,105\t17,159\t81,406\t24,256\t123,263\t1,014\t3,307
8208\t동수원\t30,089\t107,351\t33\t98\t381\t1,070\t2,310\t6,798\t7,073\t24,475\t9,739\t35,398\t10,115\t38,360\t438\t1,152
8212\t순천점\t12,643\t34,235\t17\t43\t121\t287\t1,345\t3,299\t3,371\t9,372\t3,483\t9,301\t4,008\t11,207\t298\t726
8215\t산본점\t25,656\t80,883\t31\t111\t160\t359\t1,527\t3,827\t4,342\t12,234\t7,437\t22,914\t11,848\t40,646\t311\t792
8216\t울산점\t5,303\t12,436\t4\t8\t50\t84\t503\t1,133\t1,561\t3,690\t1,366\t3,275\t1,643\t3,865\t176\t381
8217\t광명점\t18,642\t74,533\t19\t59\t189\t530\t1,639\t5,187\t4,364\t15,298\t5,621\t22,684\t6,562\t30,050\t248\t725
8218\t괴정점\t23,522\t79,652\t16\t55\t181\t392\t1,438\t4,006\t4,656\t14,564\t5,918\t19,533\t10,942\t40,274\t371\t828
8219\t울산2점\t3,162\t5,731\t2\t2\t33\t43\t277\t513\t1,105\t1,988\t880\t1,705\t772\t1,325\t93\t155
8220\t창원점\t17,546\t49,905\t13\t30\t170\t395\t2,616\t7,298\t7,379\t23,015\t4,499\t11,767\t2,494\t6,459\t375\t941
8222\t부천점\t62,013\t228,469\t86\t306\t823\t2,058\t8,090\t26,939\t19,181\t72,093\t17,433\t63,172\t15,221\t60,463\t1,179\t3,438
8223\t덕천점\t21,193\t52,724\t25\t64\t253\t474\t2,305\t5,580\t5,416\t14,498\t5,963\t14,644\t6,912\t16,754\t319\t710
8224\t송파점\t59,979\t213,479\t75\t223\t660\t1,757\t6,330\t18,175\t18,009\t60,873\t16,500\t59,786\t17,128\t69,425\t1,277\t3,240
8227\t강서점\t61,647\t244,559\t88\t328\t1,054\t2,824\t6,547\t21,590\t15,709\t59,758\t16,509\t65,438\t20,606\t91,286\t1,134\t3,335
8228\t충장점\t14,279\t38,626\t23\t55\t546\t1,037\t2,632\t6,717\t6,571\t19,485\t3,024\t7,736\t1,036\t2,504\t447\t1,092
8229\t부산대점\t27,991\t90,653\t32\t73\t1,594\t4,393\t3,963\t11,839\t10,395\t35,751\t7,515\t23,752\t3,828\t13,096\t664\t1,749
8230\t전주점\t3,246\t6,146\t3\t3\t140\t200\t732\t1,411\t1,704\t3,362\t405\t699\t87\t151\t175\t320
8231\t엑스코점\t10,737\t27,641\t18\t40\t130\t275\t1,042\t2,860\t3,855\t10,745\t2,900\t7,034\t2,626\t6,287\t166\t400
8233\t광주역점\t4,227\t10,416\t8\t13\t48\t127\t391\t759\t832\t1,757\t844\t2,114\t1,951\t5,267\t153\t379
8235\t중앙로역점\t11,082\t25,018\t13\t27\t340\t588\t1,547\t3,179\t3,780\t9,123\t2,671\t5,957\t2,405\t5,527\t326\t617
8237\t수원터미널점\t19,976\t53,675\t24\t61\t283\t557\t2,332\t5,669\t6,836\t19,691\t5,462\t14,688\t4,608\t11,977\t431\t1,032
8239\t경산점\t7,828\t18,451\t7\t18\t113\t198\t1,165\t2,713\t2,737\t6,669\t1,997\t4,741\t1,628\t3,712\t181\t400
8241\t청주점\t14,890\t44,913\t32\t104\t435\t1,058\t2,456\t6,842\t5,603\t17,473\t2,963\t9,292\t2,834\t8,566\t567\t1,578
8242\t신구로점\t36,201\t140,979\t41\t122\t713\t2,304\t4,537\t15,941\t9,744\t36,567\t9,193\t36,712\t10,440\t44,133\t1,533\t5,200
8243\t대전유성점\t32,130\t101,991\t26\t80\t1,340\t3,390\t6,251\t18,937\t10,032\t33,472\t6,648\t21,400\t6,435\t20,707\t1,398\t4,005
8501\t쇼핑점\t40,491\t125,227\t57\t166\t398\t1,161\t2,050\t5,361\t6,690\t18,959\t9,826\t30,251\t20,627\t67,182\t843\t2,147
8502\t수성점\t17,224\t74,537\t25\t85\t107\t333\t610\t2,153\t2,188\t8,501\t3,935\t16,109\t10,221\t46,942\t138\t414
8503\t구미점\t4,840\t10,935\t4\t8\t33\t102\t153\t301\t557\t1,070\t1,383\t3,208\t2,642\t6,119\t68\t127
8504\t강북점\t8,542\t19,277\t8\t13\t67\t153\t295\t571\t831\t1,692\t2,363\t5,364\t4,832\t11,187\t146\t297`;

const AGE_LABELS = ["10대이하", "20대", "30대", "40대", "50대", "60대이상", "미상"];
const META_AGE_MAP = {
  "10대이하": "10대",
  "20대": "20대",
  "30대": "30대",
  "40대": "40대",
  "50대": "50대",
  "60대이상": "60대+",
};

// 1. 데이터 파싱
const stores = raw.split("\n").map((line) => {
  const parts = line.split("\t");
  const code = parts[0];
  const name = parts[1];
  const nums = parts.slice(2).map((s) => Number(s.replace(/,/g, "")));
  const totalCustomers = nums[0];
  const totalReceipts = nums[1];
  const byAge = {};
  AGE_LABELS.forEach((label, i) => {
    byAge[label] = { customers: nums[2 + i * 2], receipts: nums[3 + i * 2] };
  });
  // primary age: 미상 제외, 최다 연령대 1개 (단, 2위가 1위의 85%↑이면 둘 다)
  const ageEntries = AGE_LABELS.slice(0, 6)
    .map((l) => [l, byAge[l].customers])
    .sort((a, b) => b[1] - a[1]);
  const primary = [ageEntries[0][0]];
  if (ageEntries[1][1] / ageEntries[0][1] >= 0.85) primary.push(ageEntries[1][0]);
  return { code, name, totalCustomers, totalReceipts, byAge, primaryAge: primary };
});

// 2. ELAND_STORES와 매칭하여 store_id 부여
const homeplusContent = readFileSync("src/data/homeplus.ts", "utf-8");
const match = homeplusContent.match(/export const ELAND_STORES[^=]*=\s*(\[[\s\S]*?\n\]);/);
const elandStores = eval(match[1]);

function normalize(s) {
  return s.replace(/^NC/, "").replace(/점$/, "").replace(/\s+/g, "");
}
const nameToId = new Map();
elandStores.forEach((s) => nameToId.set(normalize(s.name), s.id));

const enriched = stores.map((st) => ({
  storeId: nameToId.get(normalize(st.name)) ?? null,
  storeCode: st.code,
  storeName: st.name,
  totalCustomers: st.totalCustomers,
  totalReceipts: st.totalReceipts,
  byAge: st.byAge,
  primaryAge: st.primaryAge,
}));

const matched = enriched.filter((s) => s.storeId !== null);
const unmatched = enriched.filter((s) => s.storeId === null);
console.log("매칭됨:", matched.length, "/ 41");
if (unmatched.length > 0) {
  console.log("미매칭:", unmatched.map((s) => s.storeName));
}

// 3. JSON 저장
const out = {
  $schema: "./store-demographics.schema.json",
  version: "1.0",
  compiledAt: new Date().toISOString().slice(0, 10),
  source: "ERP 점포별 연령대별 구매고객수·영수증건수",
  ageLabels: AGE_LABELS,
  grandTotal: {
    customers: stores.reduce((s, x) => s + x.totalCustomers, 0),
    receipts: stores.reduce((s, x) => s + x.totalReceipts, 0),
  },
  stores: enriched,
};
writeFileSync("src/data/store-demographics.json", JSON.stringify(out, null, 2));
console.log("✅ src/data/store-demographics.json 저장");
console.log("   총 고객:", out.grandTotal.customers.toLocaleString());
console.log("   총 영수증:", out.grandTotal.receipts.toLocaleString());

// 4. eland-meta.ts 업데이트 (primary_age 자동 채움)
const idToPrimary = new Map();
matched.forEach((s) => idToPrimary.set(s.storeId, s.primaryAge.map((a) => META_AGE_MAP[a])));

let metaContent = readFileSync("src/data/eland-meta.ts", "utf-8");
const newArrayBody = Array.from({ length: 41 }, (_, i) => {
  const id = i + 1;
  const ages = idToPrimary.get(id) ?? [];
  const agesJson = JSON.stringify(ages);
  return `  {
    store_id: ${id},
    trade_area: { primary_age: ${agesJson} as AgeBand[], primary_gender: null, family_ratio: null },
    anchors: [],
    tenant_mix: { categories: [], price_band: [] },
    available_space: [],
    popup_friendly: null,
  },`;
}).join("\n");

const newSection = `// 41개점 정성 데이터 — primary_age는 점포별 ERP 구매고객 데이터로 자동 채움 (store-demographics.json)
// 나머지 슬롯(gender, family_ratio, anchors, categories, price_band, space, popup)은 단이님이 입력 예정
export const ELAND_META: StoreMeta[] = [
${newArrayBody}
];`;

metaContent = metaContent.replace(
  /\/\/ 41개 빈 정성 데이터[\s\S]*?export const ELAND_META: StoreMeta\[\] = Array\.from\(\{ length: 41 \}, \(_, i\) => empty\(i \+ 1\)\);/,
  newSection
);
writeFileSync("src/data/eland-meta.ts", metaContent);
console.log("✅ src/data/eland-meta.ts primary_age 자동 채움 완료");
