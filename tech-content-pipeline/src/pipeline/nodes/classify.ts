import OpenAI from "openai";
import { PipelineState } from "../state";
import type { ContentType, Platform } from "../state";
import { loadPrompt } from "../../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function classifyNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  // Pick first deduped article if no currentArticle set
  const article = state.currentArticle ?? state.dedupedArticles[0] ?? null;
  if (!article) {
    console.log("[classify] No article to process");
    return {};
  }

  console.log(`[classify] Processing: "${article.title}"`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: loadPrompt("classify-system.txt"),
      },
      {
        role: "user",
        content: `Title: ${article.title}\n\nDescription: ${article.description}\n\nContent: ${article.content?.slice(0, 2000)}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content!);
  const minUrgency = parseInt(process.env.MIN_URGENCY_SCORE || "3", 10);

  if (parsed.urgency_score < minUrgency) {
    console.log(`[classify] Skipping — urgency ${parsed.urgency_score} below threshold ${minUrgency}`);
    return { currentArticle: article, approvalStatus: "rejected" };
  }

  console.log(`[classify] content_type=${parsed.content_type}, urgency=${parsed.urgency_score}, platforms=${parsed.platform_fit.join(",")}`);

  return {
    currentArticle: article,
    contentType: parsed.content_type as ContentType,
    platformFit: parsed.platform_fit as Platform[],
    urgencyScore: parsed.urgency_score,
  };
}
