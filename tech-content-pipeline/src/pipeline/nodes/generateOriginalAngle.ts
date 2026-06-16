import OpenAI from "openai";
import { PipelineState } from "../state";
import { loadPrompt } from "../../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateOriginalAngleNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { structuredContent, captions } = state;
  if (!structuredContent || !captions?.linkedin) return {};

  console.log("[generateOriginalAngle] Adding original perspective...");

  const systemPrompt = loadPrompt("original-angle.txt");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Article: ${structuredContent.title}\nSummary: ${structuredContent.summary}\nKey Points: ${structuredContent.keyPoints.join(", ")}`,
      },
    ],
  });

  const originalAngle = response.choices[0].message.content!.trim();

  // Append the original angle to the LinkedIn caption
  const updatedLinkedIn = `${captions.linkedin}\n\n---\nMy take: ${originalAngle}`;

  return {
    originalAngle,
    captions: { ...captions, linkedin: updatedLinkedIn },
  };
}
