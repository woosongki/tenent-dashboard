import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import storeCategoriesRaw from "@/data/store-categories.json";
import { RETAIL_CATEGORIES, mapCatToRetail, type RetailCategory } from "./retailCategories";

// 점포별 10개 카테고리 매출 비중(ratio %) 제공자.
//
// 소스 2가지:
//   static   — src/data/store-categories.json (ERP 2026-04 정적 스냅샷, 기본값)
//   supabase — sales_offline_month 최신 ym 집계에서 파생(매출 갱신을 따라감)
//
// 전환: 환경변수 BRANCH_CATEGORY_SOURCE=supabase 일 때만 파생 사용.
//   · 기본(static)은 기존 동작 그대로 → 무설정 시 회귀 없음.
//   · supabase 모드에서도 점포별 커버리지가 낮으면(복종 매핑 실패 다수) 해당 점포는
//     static 으로 자동 폴백 → 상권분석 숫자가 조용히 틀어지지 않음.

type Ratios = Record<string, number>;

interface StaticStore { storeName: string; ratios: Ratios; }
interface StaticJson { period: string; compiledAt: string; source: string; stores: StaticStore[]; }
const STATIC = storeCategoriesRaw as unknown as StaticJson;

const staticByName = new Map<string, Ratios>(STATIC.stores.map((s) => [s.storeName, s.ratios]));

// 점포명 정규화(ERP sname ↔ 마스터 storeName 매칭용): NC 접두/점 접미/공백 제거.
function normalizeStore(s: string): string {
  return s.replace(/^NC/i, "").replace(/점$/, "").replace(/\s+/g, "");
}
// 정규화명 → 정적 JSON 의 정본 storeName (categoryGap 조인 키와 동일)
const canonByNorm = new Map<string, string>(STATIC.stores.map((s) => [normalizeStore(s.storeName), s.storeName]));

export interface CategoryRatioSource {
  ratios: Map<string, Ratios>;  // storeName(정본) → 카테고리 비중(%)
  period: string;               // 기준월/연 라벨 (예: '2026-04')
  source: "static" | "supabase";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function staticSource(): CategoryRatioSource {
  return { ratios: staticByName, period: STATIC.period, source: "static" };
}

// 커버리지 임계: 매핑된 매출이 점포 총매출의 이 비율 미만이면 파생 신뢰 불가 → static 폴백.
const MIN_COVERAGE = 0.5;

/**
 * 점포별 카테고리 비중 소스. 요청당 1회만 계산(React cache).
 * supabase 모드 실패/미설정 시 static 으로 안전 폴백.
 */
export const getStoreCategoryRatios = cache(async (): Promise<CategoryRatioSource> => {
  if (process.env.BRANCH_CATEGORY_SOURCE !== "supabase") return staticSource();

  try {
    const supabase = await createClient();
    // 최신 기준월
    const { data: latest } = await supabase
      .from("sales_offline_month")
      .select("ym")
      .order("ym", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ym = latest?.ym as string | undefined;
    if (!ym) return staticSource();

    // 최신 ym 의 store×cat×sales (페이지네이션)
    type Row = { store: string; cat: string; sales: number };
    const rows: Row[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("sales_offline_month")
        .select("store,cat,sales")
        .eq("ym", ym)
        .range(from, from + PAGE - 1);
      if (error) return staticSource();
      const batch = (data ?? []) as Row[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    if (rows.length === 0) return staticSource();

    // 정본 점포명별 집계
    const agg = new Map<string, { total: number; mapped: number; byCat: Record<string, number> }>();
    for (const r of rows) {
      const canon = canonByNorm.get(normalizeStore(r.store));
      if (!canon) continue; // 41 마스터에 없는 점포는 제외
      const sales = Number(r.sales) || 0;
      if (sales <= 0) continue;
      const e = agg.get(canon) ?? { total: 0, mapped: 0, byCat: {} };
      e.total += sales;
      const cat = mapCatToRetail(r.cat);
      if (cat) { e.mapped += sales; e.byCat[cat] = (e.byCat[cat] ?? 0) + sales; }
      agg.set(canon, e);
    }

    // 점포별 비중 계산 + 커버리지 부족 시 static 폴백
    const out = new Map<string, Ratios>();
    for (const [canon, e] of agg) {
      if (e.total <= 0 || e.mapped / e.total < MIN_COVERAGE) {
        const fb = staticByName.get(canon);
        if (fb) out.set(canon, fb);
        continue;
      }
      const ratios: Ratios = {};
      for (const cat of RETAIL_CATEGORIES) ratios[cat] = round1(((e.byCat[cat] ?? 0) / e.total) * 100);
      out.set(canon, ratios);
    }
    // 집계에 아예 없던 점포는 static 으로 보충
    for (const [name, r] of staticByName) if (!out.has(name)) out.set(name, r);

    return { ratios: out, period: ym, source: "supabase" };
  } catch {
    return staticSource();
  }
});

/** 카테고리 데이터 기준 메타(라벨용). */
export async function getCategoryDataMeta(): Promise<{ period: string; source: "static" | "supabase" }> {
  const s = await getStoreCategoryRatios();
  return { period: s.period, source: s.source };
}

export type { RetailCategory };
