import "server-only";
import type { NewsArticle, NewsCategory } from "./types";

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverNewsResponse {
  total: number;
  items: NaverNewsItem[];
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function classifyCategory(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();

  if (/출점|신규 매장|점포 확장|매장 오픈|입점|개점/.test(text)) return "출점·매장 전략";
  if (/카테고리|신사업|브랜드 확장|사업 다각화|신규 사업/.test(text)) return "카테고리 확장";
  if (/물류|유통|배송|센터|창고|공급망/.test(text)) return "인프라·물류";
  if (/소송|규제|과징금|공정위|행정처분|위반|불공정/.test(text)) return "법적·규제 이슈";
  if (/대표이사|ceo|임원|인사|조직|경영진|대표/.test(text)) return "인사·조직 변동";
  if (/유상증자|회사채|차입|대출|신용|재무|적자|흑자|매출/.test(text)) return "재무 이벤트";
  if (/온라인|오프라인|o2o|omni|옴니채널|디지털/.test(text)) return "온·오프 연계";
  return "기타";
}

function assessReliability(link: string): NewsArticle["reliability"] {
  const trusted = [
    "chosun", "joongang", "donga", "hani", "khan",
    "yonhap", "edaily", "hankyung", "mk", "maeil",
    "thebell", "fn", "news1", "newsis",
  ];
  const domain = new URL(link).hostname.replace("www.", "");
  const isTrusted = trusted.some((t) => domain.includes(t));
  return isTrusted ? "보도 확인" : "참고";
}

export async function fetchNews(companyName: string): Promise<NewsArticle[]> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const query = encodeURIComponent(`"${companyName}"`);
  const url = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=100&start=1&sort=date`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NaverNewsResponse;

    // 최근 12개월 필터
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    return (data.items ?? [])
      .filter((item) => new Date(item.pubDate) >= cutoff)
      .map((item) => {
        const title = stripHtml(item.title);
        const description = stripHtml(item.description);
        const link = item.originallink || item.link;
        return {
          title,
          originallink: link,
          link: item.link,
          description,
          pubDate: item.pubDate,
          category: classifyCategory(title, description),
          reliability: assessReliability(link),
        } satisfies NewsArticle;
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}
