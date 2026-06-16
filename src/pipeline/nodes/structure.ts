import OpenAI from "openai";
import { PipelineState } from "../state";
import type { StructuredContent } from "../state";
import { loadPrompt } from "../../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function structureNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { currentArticle, contentType } = state;
  if (!currentArticle || !contentType) return {};

  console.log(`[structure] Structuring as ${contentType}`);

  const structurePrompt = loadPrompt(`structure-${contentType}.txt`);
  const toneProfile = loadPrompt("tone-profile.txt");
  const toneContext = toneProfile.includes("[PASTE YOUR POSTS HERE]")
    ? ""
    : `\n\nMatch the voice of these example posts:\n${toneProfile.slice(0, 1000)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a tech content strategist. ${structurePrompt}
Return valid JSON with fields: title, hook, summary, keyPoints (array), techStack (array),
targetAudience, diagramNeeded (boolean), diagramDescription (optional string), imagePrompt, tone.
tone must be one of: educational | conversational | hype | analytical${toneContext}`,
      },
      {
        role: "user",
        content: `Article:\nTitle: ${currentArticle.title}\nContent: ${currentArticle.content?.slice(0, 4000)}`,
      },
    ],
  });

  const structuredContent = JSON.parse(response.choices[0].message.content!) as StructuredContent;
  console.log(`[structure] Done. diagramNeeded=${structuredContent.diagramNeeded}`);

  return { structuredContent };
}
