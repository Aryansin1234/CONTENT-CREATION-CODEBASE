import OpenAI from "openai";
import { PipelineState } from "../state";
import { loadPrompt } from "../../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateVideoScriptNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { structuredContent, contentType } = state;

  // Only for tutorial and tool_spotlight
  if (!structuredContent || !["tutorial", "tool_spotlight"].includes(contentType ?? "")) {
    return {};
  }

  console.log("[generateVideoScript] Writing 60s video script...");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Write a 60-second vertical video script (YouTube Shorts / TikTok / Instagram Reels).

Structure:
[0–3s] HOOK: One sentence that makes them stop scrolling. Start with a number or surprising claim.
[3–15s] SETUP: Why this matters in 2-3 sentences.
[15–45s] VALUE: 3 key points, one sentence each. Number them.
[45–55s] DEMO/EXAMPLE: One concrete example or quick tip.
[55–60s] CTA: "Follow for more" + one specific thing to do next.

Rules:
- Write for spoken delivery — short sentences, no jargon
- Include [PAUSE] markers where the speaker should pause
- Include [B-ROLL: description] markers for what to show on screen
- Max 180 words total`,
      },
      {
        role: "user",
        content: `Title: ${structuredContent.title}\nHook: ${structuredContent.hook}\nKey Points: ${structuredContent.keyPoints.slice(0, 3).join(" | ")}`,
      },
    ],
  });

  const videoScript = response.choices[0].message.content!;
  console.log("[generateVideoScript] Script generated");

  return { videoScript };
}
