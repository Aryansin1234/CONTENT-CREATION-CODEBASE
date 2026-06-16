import OpenAI from "openai";
import { PipelineState } from "../state";
import type { StructuredContent, PlatformCaptions } from "../state";
import { loadPrompt } from "../../utils/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getToneContext(): string {
  const toneProfile = loadPrompt("tone-profile.txt");
  if (toneProfile.includes("[PASTE YOUR POSTS HERE]")) return "";
  return `\n\nWrite in this author's voice — match their vocabulary, sentence length, and energy:\n${toneProfile.slice(0, 800)}`;
}

export async function generateCaptionsNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { structuredContent, contentType, platformFit } = state;
  if (!structuredContent) return {};

  console.log(`[generateCaptions] Generating for platforms: ${platformFit.join(", ")}`);

  const [linkedin, instagram, twitterThread] = await Promise.all([
    platformFit.includes("linkedin")
      ? generateLinkedIn(structuredContent, contentType!)
      : Promise.resolve(""),
    platformFit.includes("instagram")
      ? generateInstagram(structuredContent)
      : Promise.resolve(""),
    platformFit.includes("twitter")
      ? generateTwitterThread(structuredContent, contentType!)
      : Promise.resolve([]),
  ]);

  return {
    captions: {
      linkedin: linkedin as string,
      instagram: instagram as string,
      twitterThread: twitterThread as string[],
    } as PlatformCaptions,
  };
}

async function generateLinkedIn(content: StructuredContent, contentType: string): Promise<string> {
  const tone = contentType === "tutorial" ? "educational and authoritative" : "conversational and insightful";
  const systemPrompt = `${loadPrompt("caption-linkedin.txt")}\nTone: ${tone}${getToneContext()}`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Title: ${content.title}\nHook: ${content.hook}\nKey Points:\n${content.keyPoints.join("\n")}\nAudience: ${content.targetAudience}`,
      },
    ],
  });
  return response.choices[0].message.content!;
}

async function generateInstagram(content: StructuredContent): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: loadPrompt("caption-instagram.txt") },
      {
        role: "user",
        content: `Title: ${content.title}\nSummary: ${content.summary}\nTech Stack: ${content.techStack.join(", ")}`,
      },
    ],
  });
  return response.choices[0].message.content!;
}

async function generateTwitterThread(content: StructuredContent, _contentType: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: loadPrompt("caption-twitter.txt") },
      {
        role: "user",
        content: `Title: ${content.title}\nKey Points:\n${content.keyPoints.join("\n")}\nHook: ${content.hook}`,
      },
    ],
  });
  const parsed = JSON.parse(response.choices[0].message.content!);
  return parsed.tweets;
}
