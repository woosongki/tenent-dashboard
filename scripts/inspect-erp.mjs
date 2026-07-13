// (지점|복종|브랜드) 매칭 감사: 매출비교 vs 평당(지점) 사이 어긋난 조합 전수 리스트
import XLSX from "xlsx";
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "scoredata/6.특정(당월)_DB_12일 누적.xlsx";
const wb = XLSX.read(readFileSync(path), { type: "buffer" });

function findHeader(rows, first) {
  for (let i = 0; i < 8; i++) if (rows[i] && rows[i][0] === first) return i;
  return -1;
}

// 매출비교 → (store|cat|brand) → { sCur, sPrev }
const mainSheetName = wb.SheetNames.find((n) => n.includes("매출비교") && n.includes("브랜드"));
const mainMap = new Map();
const mainStores = new Set();
const mainBrands = new Set();
{
  const ws = wb.Sheets[mainSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const h = findHeader(rows, "구매그룹(Now:손익센터)");
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const gcode = r[0], cat = r[1], bname = r[3], scode = r[4], sname = r[5];
    if (!sname || !scode || scode === "결과" || !String(scode).includes("/") || !bname) continue;
    if (bname === "지정되지 않음") continue;
    mainMap.set(`${sname}|${cat}|${bname}`, { sCur: r[6] || 0, sPrev: r[7] || 0 });
    mainStores.add(sname);
    mainBrands.add(bname);
  }
}

// 26년 평당(지점) → (store|cat|brand) → { area, cnt }
const pName = wb.SheetNames.find((n) => n.includes("26년") && n.includes("평당") && n.includes("지점"));
const pyeongMap = new Map();
const pyeongStores = new Set();
const pyeongBrands = new Set();
{
  const ws = wb.Sheets[pName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const h = findHeader(rows, "플랜트");
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const store = r[1], cat = r[3], bcode = r[4], bname = r[5];
    if (!store || !bname || !bcode || bcode === "결과") continue;
    if (bname === "지정되지 않음" || bcode === "#") continue;
    pyeongMap.set(`${store}|${cat}|${bname}`, { area: r[7] || 0, cnt: r[10] || 0 });
    pyeongStores.add(store);
    pyeongBrands.add(bname);
  }
}

console.log(`매출비교 rows: ${mainMap.size}, 평당 rows: ${pyeongMap.size}\n`);

// 평당엔 있는데 매출비교엔 없는 조합 (= area 잡히지 않는 케이스)
const missingInMain = [];
for (const [k, v] of pyeongMap) {
  if (!mainMap.has(k)) missingInMain.push({ key: k, ...v });
}
console.log(`평당엔 있으나 매출비교엔 없음 (area 유실): ${missingInMain.length}`);
console.log(`샘플 20:`);
missingInMain.slice(0, 30).forEach((r) => console.log(`  ${r.key}  area=${r.area}, cnt=${r.cnt}`));

// 지점명 기준 unmatched (지점명 완전 어긋난 경우)
console.log(`\n지점명 매출비교에만 있음:`, [...mainStores].filter((s) => !pyeongStores.has(s)));
console.log(`지점명 평당에만 있음:`, [...pyeongStores].filter((s) => !mainStores.has(s)));

// 브랜드명 후보 매칭: 매출비교 brand에는 있지만 평당 brand에는 없는 것들 (지점 무관, 상위)
const brandOnlyMain = [...mainBrands].filter((b) => !pyeongBrands.has(b));
const brandOnlyPyeong = [...pyeongBrands].filter((b) => !mainBrands.has(b));
console.log(`\n매출비교에만 있는 브랜드 (상위 30):`, brandOnlyMain.slice(0, 30));
console.log(`\n평당에만 있는 브랜드 (상위 30):`, brandOnlyPyeong.slice(0, 30));
