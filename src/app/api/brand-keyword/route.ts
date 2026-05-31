import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface NaverItem {
  title: string;
  link: string;
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

interface NaverShopResponse {
  total: number;
  start: number;
  display: number;
  items: NaverItem[];
}

export interface BrandKeywordResult {
  brand: string;
  total: number;
  fetched: number;
  priceStats: {
    min: number | null;
    avg: number | null;
    max: number | null;
  };
  uniqueSellers: number;
  topSellers: Array<{ name: string; count: number }>;
  relatedKeywords: Array<{ keyword: string; count: number }>;
  categories: Array<{ name: string; count: number; pct: number }>;
  topBrands: Array<{ name: string; count: number }>;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// 한국어 쇼핑 타이틀에서 의미없는 토큰 제외
const STOPWORDS = new Set([
  "정품", "공식", "신상", "신상품", "베스트", "인기", "추천", "특가", "할인", "세일", "이벤트",
  "무료", "무료배송", "당일", "당일발송", "오늘", "오늘출발", "출고", "빠른배송",
  "리뷰", "후기", "이상", "이하", "포함", "제외",
  "for", "the", "and", "with", "of", "in", "by",
]);

function tokenize(title: string): string[] {
  const cleaned = stripHtml(title);
  // 한글·영문·숫자 토큰 분리 ([] () 제거, 특수문자/공백으로 분리)
  return cleaned
    .split(/[\s,/\-_·•·~|+:;.!?()\[\]{}『』「」<>"'%]+/)
    .map((t) => t.trim())
    .filter((t) => {
      if (t.length < 2) return false;
      if (STOPWORDS.has(t.toLowerCase())) return false;
      if (/^\d+$/.test(t)) return false; // 순수 숫자 제외
      return true;
    })
    .map((t) => t.toLowerCase());
}

async function fetchNaverPage(brand: string, start: number): Promise<NaverShopResponse | null> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(brand)}&display=100&start=${start}&sort=sim`;
  try {
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    });
    if (!res.ok) return null;
    return (await res.json()) as NaverShopResponse;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // 인증 게이트 — 로그인하지 않은 호출 차단 (네이버 API 비용 보호)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as { brand?: string };
  const brand = body.brand?.trim();
  if (!brand) {
    return Response.json({ error: "brand 입력 필수" }, { status: 400 });
  }

  if (!process.env.NAVER_SEARCH_CLIENT_ID) {
    return Response.json({ error: "NAVER_SEARCH_CLIENT_ID 환경변수 없음" }, { status: 500 });
  }

  // 3페이지 = 최대 300개 아이템 (네이버 쇼핑 페이지당 100)
  const pages = await Promise.all([
    fetchNaverPage(brand, 1),
    fetchNaverPage(brand, 101),
    fetchNaverPage(brand, 201),
  ]);

  const first = pages[0];
  if (!first) {
    return Response.json({ error: "네이버 쇼핑 API 호출 실패" }, { status: 502 });
  }

  const items: NaverItem[] = pages.flatMap((p) => p?.items ?? []);
  if (items.length === 0) {
    return Response.json({
      brand,
      total: first.total,
      fetched: 0,
      priceStats: { min: null, avg: null, max: null },
      uniqueSellers: 0,
      topSellers: [],
      relatedKeywords: [],
      categories: [],
      topBrands: [],
    } satisfies BrandKeywordResult);
  }

  // ── 가격 통계 ────────────────────────────────────────
  const prices = items
    .map((i) => Number(i.lprice))
    .filter((p) => Number.isFinite(p) && p > 0);
  const min = prices.length > 0 ? Math.min(...prices) : null;
  const max = prices.length > 0 ? Math.max(...prices) : null;
  const avg = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

  // ── 판매처 ──────────────────────────────────────────
  const sellerCounts = new Map<string, number>();
  items.forEach((i) => {
    const name = i.mallName?.trim();
    if (name) sellerCounts.set(name, (sellerCounts.get(name) ?? 0) + 1);
  });
  const topSellers = [...sellerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // ── 연관 키워드 (브랜드명 자체는 제외) ──────────────
  const brandLower = brand.toLowerCase();
  const brandParts = new Set(tokenize(brand));
  const kwCounts = new Map<string, { display: string; count: number }>();

  items.forEach((item) => {
    const tokens = tokenize(item.title);
    const seen = new Set<string>();
    tokens.forEach((t) => {
      if (seen.has(t)) return;
      seen.add(t);
      if (t === brandLower) return;
      if (brandParts.has(t)) return;
      if (t.length < 2) return;
      const existing = kwCounts.get(t);
      if (existing) {
        existing.count += 1;
      } else {
        // 원본 표기 (첫 등장 시 대문자 유지)
        const original = item.title.split(/[\s,/\-_·•·~|+:;.!?()\[\]{}『』「」<>"'%]+/).find((x) => x.toLowerCase() === t) ?? t;
        kwCounts.set(t, { display: original.replace(/<[^>]+>/g, ""), count: 1 });
      }
    });
  });

  const relatedKeywords = [...kwCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((k) => ({ keyword: k.display, count: k.count }));

  // ── 카테고리 분포 (category1 기준) ──────────────────
  const catCounts = new Map<string, number>();
  items.forEach((i) => {
    const c = i.category1?.trim();
    if (c) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  });
  const totalCat = [...catCounts.values()].reduce((a, b) => a + b, 0);
  const categories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round((count / totalCat) * 1000) / 10 }));

  // ── 브랜드 분포 (item.brand) ────────────────────────
  const brandCounts = new Map<string, number>();
  items.forEach((i) => {
    const b = i.brand?.trim();
    if (b) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
  });
  const topBrands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const result: BrandKeywordResult = {
    brand,
    total: first.total,
    fetched: items.length,
    priceStats: { min, avg, max },
    uniqueSellers: sellerCounts.size,
    topSellers,
    relatedKeywords,
    categories,
    topBrands,
  };

  return Response.json(result);
}
