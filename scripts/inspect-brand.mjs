// (store|brand)로 조인 시 매칭 실패 잔여 케이스 감사
import XLSX from "xlsx";
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "scoredata/6.특정(당월)_DB_12일 누적.xlsx";
const wb = XLSX.read(readFileSync(path), { type: "buffer" });

function findHeader(rows, first) {
  for (let i = 0; i < 8; i++) if (rows[i] && rows[i][0] === first) return i;
  return -1;
}

const STORE_ALIAS = new Map([["NC대전 유성점", "대전유성점"]]);
const BRAND_ALIAS = new Map([
  ["애슐리퀸즈", "애슐리"],
  ["두촌가마솥밥&쭈꾸미", "두촌가마솥밥"],
  ["속초코다리냉면", "속초코다리"],
  ["다솜쥬토피아생태체험관", "다솜쥬토피아생태체험"],
  ["세라", "세라젬"],
  ["아가방", "아가방갤러리"],
  ["뷰티아울렛", "S뷰티아울렛"],
]);
function normStore(s) { return STORE_ALIAS.get(s) ?? s; }
function normBrand(b) {
  const stripped = String(b).trim().replace(/\s*\(\s*[^)]*\s*\)\s*$/, "").trim();
  return BRAND_ALIAS.get(stripped) ?? stripped;
}

const mws = wb.Sheets[wb.SheetNames.find((n) => n.includes("매출비교") && n.includes("브랜드"))];
const mrows = XLSX.utils.sheet_to_json(mws, { header: 1, defval: null });
const mh = findHeader(mrows, "구매그룹(Now:손익센터)");
const mainLeaves = [];
for (let i = mh + 1; i < mrows.length; i++) {
  const r = mrows[i]; if (!r) continue;
  const cat = r[1], bname = r[3], scode = r[4], sname = r[5];
  if (!sname || !scode || scode === "결과" || !String(scode).includes("/") || !bname) continue;
  if (bname === "지정되지 않음") continue;
  mainLeaves.push({
    store: normStore(String(sname).trim()),
    cat: String(cat || "").trim(),
    brand: normBrand(bname),
    sCur: r[6] || 0,
  });
}

const pws = wb.Sheets[wb.SheetNames.find((n) => n.includes("26년") && n.includes("평당") && n.includes("지점"))];
const prows = XLSX.utils.sheet_to_json(pws, { header: 1, defval: null });
const ph = findHeader(prows, "플랜트");
const pyeongByStoreBrand = new Map();
const pyeongByStoreCatBrand = new Map();
for (let i = ph + 1; i < prows.length; i++) {
  const r = prows[i]; if (!r) continue;
  const store = r[1], cat = r[3], bcode = r[4], bname = r[5];
  if (!store || !bname || !bcode || bcode === "결과") continue;
  if (bname === "지정되지 않음" || bcode === "#") continue;
  const ns = normStore(store);
  const nb = normBrand(bname);
  const kSB = `${ns}|${nb}`;
  const kSCB = `${ns}|${cat}|${nb}`;
  if (!pyeongByStoreBrand.has(kSB)) pyeongByStoreBrand.set(kSB, []);
  pyeongByStoreBrand.get(kSB).push({ cat, area: r[7] || 0, cnt: r[10] || 0 });
  pyeongByStoreCatBrand.set(kSCB, { area: r[7] || 0, cnt: r[10] || 0 });
}

// 매출>0 leaves 중, (s|c|b)로 안잡히지만 (s|b)로 잡히는 케이스: cat만 다른 것 (fixable via cat-agnostic join)
// (s|b)로도 안잡히는 케이스: 정말 브랜드명 미스매치 (별도 처리 필요)
const catOnlyMismatch = [];
const trueMismatch = [];
for (const r of mainLeaves) {
  if (r.sCur === 0) continue;
  if (pyeongByStoreCatBrand.get(`${r.store}|${r.cat}|${r.brand}`)) continue;
  const sb = pyeongByStoreBrand.get(`${r.store}|${r.brand}`);
  if (sb) catOnlyMismatch.push({ ...r, py: sb });
  else trueMismatch.push(r);
}
console.log(`매출>0 && (store|cat|brand) 매칭 실패: ${catOnlyMismatch.length + trueMismatch.length}`);
console.log(`  → cat만 다름 (store|brand로는 매칭됨): ${catOnlyMismatch.length}`);
console.log(`  → brand 자체 미스매치 (store|brand도 실패): ${trueMismatch.length}`);

// 여러 cat에 걸친 같은 브랜드(=(store|brand) 중복) 감사
let dupCount = 0;
for (const [k, list] of pyeongByStoreBrand) if (list.length > 1) dupCount++;
console.log(`\n평당 (store|brand) 중복(= 여러 cat에 걸친 동일 브랜드): ${dupCount}`);
// 실제 어떤 것들이 중복인지 상위 10
let shown = 0;
for (const [k, list] of pyeongByStoreBrand) {
  if (list.length > 1) {
    console.log(`  ${k}: cat들 = ${list.map((x) => x.cat).join(" / ")}`);
    if (++shown >= 20) break;
  }
}

console.log(`\ncat만 다른 케이스 샘플 20:`);
catOnlyMismatch.slice(0, 20).forEach((r) =>
  console.log(`  ${r.store}|${r.brand} 매출비교 cat=${r.cat}, 평당 cat=${r.py.map((p) => p.cat + `(${p.area})`).join("/")}`),
);

console.log(`\n정말 브랜드 미스매치 (매출비교엔 있고 평당엔 아예 없음) 샘플 20:`);
trueMismatch.slice(0, 20).forEach((r) => console.log(`  ${r.store}|${r.cat}|${r.brand}  sCur=${r.sCur}`));
