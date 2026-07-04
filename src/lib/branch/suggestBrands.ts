import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { RetailCategory } from "./categoryGap";

export interface SuggestInput {
  storeName: string;
  brand: string;               // 이랜드 점포 브랜드(뉴코아/NC 등)
  tradeAreaType: string;
  region: string;              // 예: "경기 안양시"
  weak: { cat: RetailCategory; myPct: number; cohortAvg: number; gap: number }[];
  nearbyChains: { label: string; cat: RetailCategory }[]; // 이미 리테일 지도에서 식별된 인근 외부 체인
  demographics?: string;       // 거주인구 연령/성별 요약(있으면)
}

export interface SuggestedBrand { name: string; reason: string; }
export interface CategorySuggestion { cat: string; brands: SuggestedBrand[]; }

/**
 * 빈(약한) 카테고리를 채울 외부 시장 브랜드를 Claude로 제안.
 * - 이랜드 보유 브랜드(스파오/미쏘/모던하우스/후아유/뉴발란스키즈 등)는 제외 → 외부 시장에서만.
 * - 리테일 지도에서 이미 식별된 인근 체인은 중복 제안하지 않음.
 * - 온디맨드(버튼) 호출 전용 — 평소 비용 0.
 */
export async function suggestExternalBrands(input: SuggestInput): Promise<CategorySuggestion[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `당신은 이랜드리테일(뉴코아·NC백화점·킴스클럽) 점포 MD 개발 담당자입니다.
점포의 '빈 카테고리'(상권유형 평균 대비 매출 비중이 낮은 카테고리)를 채울 입점 후보 브랜드를 제안합니다.

[원칙]
- 반드시 '외부 시장' 브랜드만 제안. 이랜드리테일이 보유·전개하는 브랜드(스파오·미쏘·모던하우스·후아유·로엠·클라비스·뉴발란스키즈·에블린·오션퍼시픽 등)는 절대 제안 금지.
- 이미 인근에 매장이 있다고 알려준 체인은 중복 제안하지 말 것.
- 한국에서 실재하며 백화점·복합몰 입점이 가능한 현실적 브랜드만. 가공의 브랜드 금지.
- 각 브랜드에 왜 이 상권/카테고리에 맞는지 1문장 근거. 상권유형·지역·인구 특성을 반영.
- 카테고리당 2~4개. 대중적 인지도와 실제 출점 가능성이 높은 순.
- 반드시 submit_suggestions 도구로만 응답.`;

  const weakStr = input.weak
    .map((w) => `- ${w.cat}: 이 점포 ${w.myPct}% vs 유형평균 ${w.cohortAvg}% (▼${w.gap}%p)`)
    .join("\n");
  const nearbyStr = input.nearbyChains.length
    ? input.nearbyChains.map((c) => `${c.label}(${c.cat})`).join(", ")
    : "없음";

  const userPrompt = `점포: ${input.brand} ${input.storeName}
지역: ${input.region}
상권유형: ${input.tradeAreaType}
${input.demographics ? `거주인구: ${input.demographics}\n` : ""}
[빈 카테고리 — 채울 대상]
${weakStr}

[이미 인근에 있는 외부 체인 — 중복 제안 금지]
${nearbyStr}

위 빈 카테고리별로 입점 후보 외부 브랜드를 submit_suggestions로 제안하세요.`;

  const tool: Anthropic.Tool = {
    name: "submit_suggestions",
    description: "빈 카테고리별 외부 입점 후보 브랜드 제안",
    input_schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cat: { type: "string", description: "빈 카테고리명(입력과 동일하게)" },
              brands: {
                type: "array",
                maxItems: 4,
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "실재하는 외부 브랜드명" },
                    reason: { type: "string", description: "이 상권/카테고리에 맞는 근거 1문장" },
                  },
                  required: ["name", "reason"],
                },
              },
            },
            required: ["cat", "brands"],
          },
        },
      },
      required: ["suggestions"],
    },
  };

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [{ ...tool, cache_control: { type: "ephemeral" } } as Anthropic.Tool],
    tool_choice: { type: "tool", name: "submit_suggestions" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude가 submit_suggestions 도구를 호출하지 않음");
  }
  const out = toolUse.input as { suggestions?: CategorySuggestion[] };
  return out.suggestions ?? [];
}
